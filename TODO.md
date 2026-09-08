# Daftar File & Komponen Form

Dokumentasi file-file yang menggunakan penamaan `Form` atau menangani fungsionalitas formulir di dalam project `SRouter` (khususnya pada `apps/web/src/components`):

---

## 1. File dengan Nama `*Form.tsx` (Eksplisit)

- [x] `apps/web/src/components/forms/combo.form.tsx` — (Dipindahkan dari `combo/ComboForm.tsx`) Form konfigurasi dan pengaturan routing combo provider.
- [ ] `apps/web/src/components/providers/ConnectionForm.tsx` — Form konfigurasi koneksi provider (API key, Base URL, testing koneksi).

---

## 2. Komponen & Dialog dengan Form Internal

- [x] ~~`apps/web/src/components/auth/AdminAuthGate.tsx`~~ — Dihapus (2026-09-08): admin kini berbasis akun user (`is_admin`), guard `/admin` pakai `/v1/users/me` + `/v1/admin/status`, tanpa master-key login terpisah.
- [x] `apps/web/src/components/dialog/keys.dialogs.tsx` — Berisi form create/edit API Key, tipe data `KeyFormData`, serta custom hook `useKeyForm`.
- [ ] `apps/web/src/components/ui/ConnectOAuthModal.tsx` — Form modal untuk integrasi OAuth & input Personal Access Token (PAT).
- [ ] `apps/web/src/components/settings/SecuritySettings.tsx` — Berisi form ganti password dan pengaturan keamanan.

---

## 3. Komponen Form di Menu Pengaturan (`apps/web/src/components/settings/`)

- [ ] `apps/web/src/components/settings/GatewaySettings.tsx`
- [ ] `apps/web/src/components/settings/AppearanceSettings.tsx`
- [ ] `apps/web/src/components/settings/LoggingSettings.tsx`
- [ ] `apps/web/src/components/settings/PlaygroundSettings.tsx`
- [ ] `apps/web/src/components/settings/DataSettings.tsx`
- [ ] `apps/web/src/components/settings/SystemSettings.tsx`
