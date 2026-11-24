# X1 Broadcast — Render deployment

App Node.js pou enskripsyon manm, admin prive, estatistik, rechèch, efase manm, ak ekspòtasyon kontak an VCF. Chak kat VCF gen non `X1 [non moun nan]`.

## Fichye
- `server.js`: API, SQLite, login admin ak ekspòtasyon VCF.
- `public/`: paj enskripsyon ak dashboard.
- `render.yaml`: konfigirasyon Render Blueprint ak disk pèmanan.
- `.env.example`: modèl varyab anviwònman pou devlopman lokal.

## Deploy sou Render ak GitHub

### 1. Mete pwojè a sou GitHub
1. Telechaje ZIP sa a epi ekstrè li.
2. Kreye yon nouvo repository sou GitHub, pa egzanp `x1-broadcast`.
3. Upload tout fichye ak dosye ki anndan pwojè a nan rasin repository a.
4. Pa janm upload fichye `.env`, bazdone SQLite, modpas, oswa sekrè.

### 2. Kreye sèvis Render la
1. Ale sou https://render.com epi konekte GitHub ou.
2. Chwazi **New +** → **Blueprint**.
3. Chwazi repository `x1-broadcast` la.
4. Render ap li `render.yaml` epi montre sèvis `x1-broadcast` la ansanm ak disk pèmanan `/var/data`.
5. Lè Render mande `ADMIN_PASSWORD`, antre yon modpas long, inik, difisil pou devine. Pa pataje li.
6. Verifye `ADMIN_USERNAME` se non ou vle a (default `admin`), epi kreye Blueprint la.

### 3. Verifye deplwaman an
- Render ap enstale depandans yo ak `npm install`, epi lanse `npm start`.
- Health check la se `/health`.
- Lè deploy la fini, ouvri URL Render la pou paj enskripsyon an.
- Dashboard admin: ajoute `/admin.html` nan fen URL la.
- Konekte ak `ADMIN_USERNAME` ak `ADMIN_PASSWORD` ou te mete.

### 4. Bazdone ak pèsistans
`render.yaml` monte disk pèmanan nan `/var/data`. Bazdone manm yo ak sesyon login yo ekri sou disk sa a. Pa retire disk la oswa chanje non li san backup. Fè backup bazdone a regilyèman. Pou aplikasyon sa a, rete sou yon sèl instance sèvis la; pa scale li sou plizyè instance.

### 5. Sekirite
- `SESSION_SECRET` Render jenere otomatikman.
- Kenbe `ADMIN_PASSWORD` sekrè; pa mete li nan GitHub.
- Aktive HTTPS (Render bay HTTPS sou domèn sèvis la).
- VCF la gen done pèsonèl: pataje li sèlman ak moun ki te bay konsantman.
- Aplikasyon an pa ajoute kontak otomatikman nan telefòn ni voye fichye nan WhatsApp. Admin telechaje VCF la epi pataje li manyèlman.

## Enpòtan sou premye modpas admin
Premye deploy la kreye admin lan ak modpas `ADMIN_PASSWORD`. Si bazdone a deja gen admin lan, chanje varyab Render la pou kont li pa ranplase modpas ki deja anrejistre a. Pa efase disk la pou reset modpas, paske sa ap efase lis manm yo tou. Pou chanje modpas pita, mande yon fonksyon reset modpas sekirize oswa fè chanjman kontwole sou bazdone a.

## Limitasyon vèsyon sa a
- SQLite bon pou yon ti sèvis ki sou yon sèl instance ak disk pèmanan.
- Estatistik dat yo baze sou lè UTC sèvè a.
- Paj admin montre dènye 100 manm nan dashboard; rechèch ka retounen jiska 500.
- Pa gen fonksyon otomatik pou voye mesaj WhatsApp oswa ajoute moun nan gwoup.
