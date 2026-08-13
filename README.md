# MOSLY DELIVERY

Modern, prémium és mobilbarát weboldal helyi másnapi csomagkiszállító szolgáltatáshoz, Supabase támogatással.

## 1. Supabase projekt létrehozása

1. Jelentkezz be a Supabase felületre.
2. Hozz létre egy új projektet.
3. Jegyezd meg a projekt URL-t és a anon kulcsot.
4. Engedélyezd az Email/Password autentikációt a Authentication menüben.

## 2. SQL telepítése

A `sql/` mappában található fájlokat a Supabase SQL Editorben kell futtatni ebben a sorrendben:

1. `schema.sql`
2. `policies.sql`
3. `functions.sql`
4. `seed.sql`

## 3. Authentication bekapcsolása

A Supabase projektben:

- Authentication > Providers > Email
- Engedélyezd az Email/Password bejelentkezést.
- Ellenőrizd, hogy a Sign up / Sign in funkció aktiválva van.

## 4. Első admin létrehozása

Az első admin felhasználó létrehozása a Supabase Authentication felületén történik.

Példa:

- e-mail: admin@moslydelivery.hu
- jelszó: *biztonságos jelszó*

Ezután a `profiles` táblában hozz létre egy rekordot azonos `id` értékkel, `role = 'admin'` és `is_active = true` beállítással.

## 5. profiles rekord létrehozása

Példa SQL:

```sql
INSERT INTO public.profiles (id, email, full_name, role, is_active)
VALUES (
  'YOUR_AUTH_USER_ID',
  'admin@moslydelivery.hu',
  'Mosly Admin',
  'admin',
  true
);
```

A `YOUR_AUTH_USER_ID` a Supabase auth.users táblában lévő felhasználó UUID-je.

## 6. Supabase URL beállítása

Nyisd meg a `js/supabase.js` fájlt és állítsd be:

```js
export const SUPABASE_URL = 'https://your-project.supabase.co';
export const SUPABASE_ANON_KEY = 'your-anon-key';
```

## 7. Anon key beállítása

A Supabase Dashboarbdon a Project Settings > API menüben kinyerhető az anon/public kulcs.

## 8. Weboldal indítása

A projekt gyökérkönyvtárából egyszerűen nyisd meg a `index.html` fájlt, vagy helyezz el egy statikus szerveren.

Példa lokális megnyitás:

```bash
python -m http.server 8000
```

Ezután a böngészőben nyisd meg:

- http://localhost:8000

## 9. GitHub Pages használata

1. Töltsd fel a projektet GitHub repo-ba.
2. A Settings > Pages menüpontban válaszd a root mappát.
3. A felület automatikusan publikálja a weboldalt.
4. Használhatsz egy `index.html` gyökerű projektet közvetlenül.

## 10. Nginx használata

Példa konfiguráció:

```nginx
server {
  listen 80;
  server_name moslydelivery.hu;
  root /var/www/mosly-delivery;
  index index.html;

  location / {
    try_files $uri $uri/ =404;
  }
}
```

## 11. Saját domain beállítása

1. Vedd fel a domainet a szolgáltatónál.
2. Kösd a domain DNS rekordját az oldal szerverére / GitHub Pages-re.
3. Kapcsold be a TLS tanúsítványt (Cloudflare, Let's Encrypt stb.).
4. Ellenőrizd a főoldal és a belső oldalak működését a domain alatt.

## Biztonság és adatvédelem

- A frontendben soha ne legyen `service_role` kulcs.
- A nyilvános csomagkövetés csak a `get_public_tracking_info` funkció által engedélyezett adatokhoz férhet hozzá.
- A személyes adatok (név, e-mail, telefonszám, cím, megjegyzés) nem nyilvánosak.
- Az RLS policy-k és a Supabase funkciók biztosítják a jogosultságkezelést.

## Főbb szerepkörök

- `admin` – teljes hozzáférés
- `mosly_employee` – rendelés rögzítése, megnézése és kezelése
- `courier` – futári nézet és státusz módosítás

## Következő lépések

- A Supabase projektben létrehozott felhasználók és profilok összekötése az autentikációval.
- A csomag státuszok és történet frissítése a futári felületen.
- A live felülethez a projekthez tartozó real Supabase URL és anon key beállítása.
