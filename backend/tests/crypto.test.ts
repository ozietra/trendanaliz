import { describe, it, expect } from 'vitest';
import { encrypt, decrypt } from '../src/utils/crypto';

describe('AES-256-GCM encrypt/decrypt', () => {
  it('düz metin → şifrele → çöz → aynı düz metin', () => {
    const plain = 'sk_test_1234567890_secret_api_key';
    const cipher = encrypt(plain);
    expect(cipher).not.toEqual(plain);
    expect(cipher).toContain(':');
    const decoded = decrypt(cipher);
    expect(decoded).toEqual(plain);
  });

  it('boş string için hata atmaz', () => {
    expect(decrypt(encrypt(''))).toEqual('');
  });

  it('aynı plaintext için her çağrıda farklı cipher üretir (random IV)', () => {
    const a = encrypt('payload');
    const b = encrypt('payload');
    expect(a).not.toEqual(b);
    expect(decrypt(a)).toEqual('payload');
    expect(decrypt(b)).toEqual('payload');
  });

  it('bozulmuş cipher için ham metni geri döner (legacy compat)', () => {
    // decrypt() geri uyumluluk için throw yerine ham veriyi döner
    const bad = 'aa:bb:cc';
    expect(decrypt(bad)).toEqual(bad);
  });

  it('iki bölümlü string şifrelenmemiş veri kabul edilir', () => {
    expect(decrypt('legacy_value')).toEqual('legacy_value');
  });

  it('uzun değerler doğru round-trip yapar', () => {
    const plain = 'x'.repeat(5000);
    expect(decrypt(encrypt(plain))).toEqual(plain);
  });
});
