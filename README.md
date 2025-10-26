# Billman Virtual Keyboard (HU)

Virtuális magyar billentyűzet webes űrlapokhoz és szerkeszthető mezőkhöz KIOSK-on futó böngészők számára. Támogatja a **drag & drop** mozgatást, **minimalizálást/dokkolást**, **fókusz-követést**, a javított **Backspace/Delete** viselkedést, valamint a **Ctrl/Alt/AltGr/Shift/CapsLock** módosítókat és a magyar ékezeteket.

> Licenc: MIT • Szerző: ChatGPT • Javítások: Szécsényi Zoltán
Figyelem! Az egész projektet promptolva kezdtem, amivel 95%-ig jutottam. Ezt követően kézzel javítottam a kódot több iterációban. A befektett munka összesen 3 óra volt.
---

## Fő funkciók

* **HU-aware beviteli réteg**: AltGr és Shift térképezések, ékezetes összevonások (pl. `o:`→`ö`, `u'`→`ű`).
* **Fókusz-követés**: automatikusan a legutóbb fókuszban lévő, írható mezőbe gépel.
* **Draggable UI**: billentyűzet mozgatása egérrel vagy érintéssel.
* **Minimalizálható**: dokkolt **FAB** gombbal (jobb alsó sarok). Állapot megőrzés `localStorage`-ban.
* **Shadow DOM** (opcionális): elszigetelt stílusok.
* **Fixelt Backspace/Delete/Enter/Tab/Space**: megbízható kurzorkezelés és kijelöléscsere.

## Gyors indulás

```html
<div id="vk"></div>
<textarea id="t" placeholder="Írj ide…"></textarea>
<script type="module">
  import { VirtKeyboard } from './VirtKeyboard.js';
  const kb = new VirtKeyboard({
    container: '#vk',
    target: '#t',        // opcionális, followFocus mellett elhagyható
    followFocus: true,
    draggable: true,
    minimizable: true,
    dockCorner: 'bottom-right'
  });
</script>
```

## Telepítés

1. Másold a `VirtKeyboard.js` fájlt a projekted statikus JS mappájába.
2. Importáld **ES Module**-ként (lásd a fenti példát).
3. Helyezz el egy konténert (`div#vk`) a billentyűzetnek.

## API

### Konstruktor

```ts
new VirtKeyboard(opts?: VirtKeyboardOptions)
```

**Opciók (alapértékekkal):**

```ts
{
  container: HTMLElement|string,           // KÖTELEZŐ
  target?: HTMLInputElement|HTMLTextAreaElement|HTMLElement|string,
  useShadow?: true,
  layout?: 'qwertz'|'qwerty' = 'qwertz',
  hunCompose?: true,
  attachAtCursor?: true,
  onKey?: (ev: any) => void,               // (belsőleg nem kötelező, események lásd lejjebb)
  draggable?: true,
  minimizable?: true,
  startMinimized?: true,
  dockCorner?: 'bottom-right'|'bottom-left'|'top-right'|'top-left' = 'bottom-right',
  rememberPosition?: true,
  storageKey?: 'virtkeyboard',
  followFocus?: true
}
```

### Nyilvános metódusok

* `attachTo(target)` – Csatolja új célmezőhöz.
* `destroy()` – Eltávolítja a komponens DOM-ját.
* `minimize()` / `restore()` / `toggle()` – Állapotváltás.
* `setPosition(x, y)` – Abszolút pozicionálás (px).
* `setDockCorner(corner)` – FAB dokkolási sarok beállítása.

## Események

A komponens a **cél elemre** (vagy ha nincs, a konténerre) lő ki DOM eseményeket:

* `beforeinput` *(cancelable)* – `detail: { inputType: 'insertReplacementText', data: string }`.
* `input` – `detail: { value: string }` a frissített értékkel.
* `toggle` – módosítók vizuális/állapoteseménye: `detail: { kind: 'caps'|'shift'|'alt'|'ctrl'|'altgr', value: boolean }`.

> Tipp: Figyeld ezeket az eseményeket validációhoz, karakter-szűréshez vagy telemetriához.

## Magyar beviteli sajátosságok

* **Compose (összevonás)**: egy korábbi jel + új karakter → ékezetes betű.

  * Példák: `o:`→`ö`, `u:`→`ü`, `o'`→`ő`, `u'`→`ű`, továbbá kis/nagybetűs variánsok (`O:`→`Ö`, stb.).
* **AltGr réteg**: közismert HU kiosztás szerinti jelek (pl. `AltGr+v`→`@`, `AltGr+q`→`\`, `AltGr+8`→`˙`, stb.).
* **Shift/CapsLock**: betűknél XOR logika (Caps ⊕ Shift), nem betűnél `shiftMap` szerinti helyettesítés.

## Célmezők (target) támogatása

* `input[type=text|search|email|url|tel|password|number]`
* `textarea`
* `contenteditable` elemek (`contenteditable="true"` vagy `isContentEditable`)

## Stílus és elhelyezés

* Alap UI: kártya (mozgatás: fejléccel), és egy **FAB** gomb minimalizált állapotban.
* Pozíció megőrzése: `localStorage[storageKey]` – `x`, `y`, `minimized`, `dockCorner`.
* A FAB jelenleg **jobb alsó sarokba** dokkol (fix), a `setDockCorner()` előkészített a jövőbeli bővítéshez.

## Böngésző támogatás

* **Modern Chromium/Firefox/Safari/Edge**. Követelmény: `CustomEvent`, `Shadow DOM` (ha `useShadow: true`).
* Mobil: érintés támogatott (drag), virtuális billentyűzetek viselkedése böngészőnként eltérhet.

## Hozzáférhetőség

* Gombok natív `<button>` elemek.
* Fókusz megtartása: kattintáskor visszaadja a fókuszt a célmezőnek (ha írható).
* Eseménykibocsátás a beviteli folyamat külső figyeléséhez.

## Tippek integrációhoz

* **Form-kit/SPA**: eseményekkel illeszthető szabályokhoz, maszkokhoz, undo/redo-hoz.
* **Shadow DOM üzemmód**: minimalizálja a stílusütközést.
* **Élő váltás mezők között**: `followFocus: true` esetén nem kell kézzel `attachTo`-zni.

## Ismert korlátok / TODO

* QWERTY/QWERTZ sorok HU-specifikus finomhangolása bővíthető.
* AltGr és Shift térkép kiegészíthető speciális jelekkel.
* FAB dokkolás több sarokba (beállítás megvan, viselkedés egységesítendő UI oldalon).

## Fejlesztés

* Forrás: `VirtKeyboard.js` – moduláris, ES Module.
* Kódstílus: modern DOM API, `Map`, árnyék DOM opcionális.
* Hozzájárulás: PR-ben javasolj új HU-kombinációkat és AltGr térképeket.

## Változásnapló (rövid)

* **v1.0.0**: első nyilvános HU-támogatással, drag+minimize, fókusz-követés, javított szerkesztési műveletek.

---

## Licenc

MIT. A részletek a fájl fejléceiben és a projekt licencében találhatók.
