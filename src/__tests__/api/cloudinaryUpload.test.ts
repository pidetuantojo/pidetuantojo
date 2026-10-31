// @vitest-environment node
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const getCaller = vi.fn();
const upload = vi.fn();

vi.mock('@/lib/auth/serverAuth', async () => {
  class AuthError extends Error {
    constructor(
      message: string,
      readonly status: number
    ) {
      super(message);
    }
  }
  return {
    AuthError,
    getCaller,
    errorResponse: (e: AuthError) => Response.json({ error: e.message }, { status: e.status }),
  };
});
vi.mock('cloudinary', () => ({ v2: { config: vi.fn(), uploader: { upload } } }));

let POST: typeof import('@/app/api/cloudinary/upload/route').POST;
let AuthErrorCtor: new (m: string, s: number) => Error;
beforeAll(async () => {
  ({ POST } = await import('@/app/api/cloudinary/upload/route'));
  ({ AuthError: AuthErrorCtor } = (await import('@/lib/auth/serverAuth')) as unknown as {
    AuthError: new (m: string, s: number) => Error;
  });
});

function request(file?: File) {
  const form = new FormData();
  if (file) form.append('file', file);
  return new Request('http://localhost/api/cloudinary/upload', {
    method: 'POST',
    body: form,
  }) as never;
}

const png = (size = 10) => new File([new Uint8Array(size)], 'a.png', { type: 'image/png' });

describe('POST /api/cloudinary/upload', () => {
  beforeEach(() => {
    getCaller.mockReset().mockResolvedValue({ uid: 'u1', role: 'owner', restaurantId: 'r1' });
    upload.mockReset().mockResolvedValue({ secure_url: 'https://cdn.test/x' });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('sin token da 401', async () => {
    getCaller.mockRejectedValue(new AuthErrorCtor('No autenticado', 401));
    const res = await POST(request(png()));
    expect(res.status).toBe(401);
    expect(upload).not.toHaveBeenCalled();
  });

  it('tipo no permitido da 415', async () => {
    const res = await POST(request(new File(['x'], 'a.svg', { type: 'image/svg+xml' })));
    expect(res.status).toBe(415);
  });

  it('imagen mayor a 5 MB da 413', async () => {
    const res = await POST(request(png(5 * 1024 * 1024 + 1)));
    expect(res.status).toBe(413);
  });

  it('PDF mayor a 10 MB da 413', async () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'a.pdf', { type: 'application/pdf' });
    expect((await POST(request(big))).status).toBe(413);
  });

  it('sin archivo da 400', async () => {
    expect((await POST(request())).status).toBe(400);
  });

  it('sube una imagen a la carpeta del restaurante y devuelve { url }', async () => {
    const res = await POST(request(png()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: 'https://cdn.test/x' });
    expect(upload.mock.calls[0][1]).toMatchObject({ folder: 'antojo-app/r1', resource_type: 'image' });
  });

  it('sube un PDF como raw', async () => {
    const pdf = new File([new Uint8Array(100)], 'f.pdf', { type: 'application/pdf' });
    const res = await POST(request(pdf));
    expect(res.status).toBe(200);
    expect(upload.mock.calls[0][1]).toEqual({ folder: 'antojo-app/r1', resource_type: 'raw' });
  });

  it('super admin sin restaurante usa antojo-app; otro rol sin restaurante da 403', async () => {
    getCaller.mockResolvedValue({ uid: 's', role: 'super_admin' });
    await POST(request(png()));
    expect(upload.mock.calls[0][1]).toMatchObject({ folder: 'antojo-app' });

    getCaller.mockResolvedValue({ uid: 'u', role: 'owner' });
    expect((await POST(request(png()))).status).toBe(403);
  });
});
