/**
 * Procedural pixel-art renderer for AI-Office.
 *
 * Zero asset files — every sprite is baked onto offscreen canvases at boot,
 * the same discipline as AI-farm's visual overhaul: a deliberately limited
 * palette, per-cell hashes to vary tiles without storing anything, saturated
 * colour rationed to the things that matter (agents, screens, coffee), and a
 * tiny bitmap font authored in-repo so labels stay crisp at native resolution.
 *
 * The world is drawn at native 16px-per-tile resolution onto an offscreen
 * canvas, then blitted to the display canvas at an integer-ish scale with
 * image smoothing off.
 */
"use strict";

var OfficeRender = (function () {
  var S = OfficeSim;
  var TILE = 16;
  var W = S.COLS * TILE, H = S.ROWS * TILE;

  // --- Palette ("late shift" family) ----------------------------------------
  // Carpet is the one cool ramp; wood and plaster stay low-chroma so the only
  // saturated pixels are agents, screens, plants and the coffee LED.
  var P = {
    // carpet (cool blue-gray, work area)
    carp0: 0x232b3a, carp1: 0x2b3547, carp2: 0x344056, carp3: 0x3e4b63,
    // vinyl (warm gray, break area)
    vin0: 0x2e2b30, vin1: 0x38343a, vin2: 0x423d44, vin3: 0x4d474e,
    // walls / plaster
    wall0: 0x1a1721, wall1: 0x3f3a4a, wall2: 0x554f61, wall3: 0x6a6377,
    // wood (desks, table, cabinet)
    wood0: 0x2a1c10, wood1: 0x44301b, wood2: 0x5f4528, wood3: 0x7d5d38, wood4: 0x9c7a4c,
    // metal / plastic
    metal0: 0x23252c, metal1: 0x3c3f49, metal2: 0x585c68, metal3: 0x7d8290,
    // rationed accents
    screen0: 0x0d3b46, screen1: 0x1a7f8c, screen2: 0x3fd0d4, screen3: 0xb8fff2,
    red1: 0x9c2b2b, red2: 0xd6493a, orange1: 0xc27a2c, orange2: 0xf0a848,
    leaf1: 0x2e6b34, leaf2: 0x4b9440, leaf3: 0x77bd58,
    blue1: 0x3a5da8, blue2: 0x6f93d8, blue3: 0xa9c4f0,
    gold1: 0xc9a44e, gold2: 0xf5d067,
    // people
    skin1: 0xb5764f, skin2: 0xe0a878, hair1: 0x241b15, hair2: 0x4a3423,
    ink: 0x120f16, bone: 0xf4efe0,
    // sky keyframes (windows)
    skyNight: 0x101430, skyDawn: 0xc9744f, skyDay: 0x7fb2e0, skyDusk: 0x8f4f6e
  };

  function css(hex) { return "#" + (hex & 0xffffff).toString(16).padStart(6, "0"); }
  function rgba(hex, a) {
    return "rgba(" + ((hex >> 16) & 0xff) + "," + ((hex >> 8) & 0xff) + "," + (hex & 0xff) + "," + a + ")";
  }
  function mix(a, b, t) {
    var ar = (a >> 16) & 0xff, ag = (a >> 8) & 0xff, ab = a & 0xff;
    var br = (b >> 16) & 0xff, bg = (b >> 8) & 0xff, bb = b & 0xff;
    return (((ar + (br - ar) * t) | 0) << 16) | (((ag + (bg - ag) * t) | 0) << 8) | ((ab + (bb - ab) * t) | 0);
  }

  // --- Pixel toolkit ----------------------------------------------------------

  function bake(w, h, draw) {
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    var g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    draw(g);
    return c;
  }
  function rect(g, x, y, w, h, c, a) { g.fillStyle = a !== undefined ? rgba(c, a) : css(c); g.fillRect(x | 0, y | 0, w | 0, h | 0); }
  function px(g, x, y, c, a) { rect(g, x, y, 1, 1, c, a); }
  function frame(g, x, y, w, h, c) {
    rect(g, x, y, w, 1, c); rect(g, x, y + h - 1, w, 1, c);
    rect(g, x, y, 1, h, c); rect(g, x + w - 1, y, 1, h, c);
  }

  // --- 3x5 bitmap font (authored in-repo, uppercase + digits) -----------------

  var FONT = {
    A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110",
    E: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101",
    I: "111010010010111", J: "001001001101010", K: "101110100110101", L: "100100100100111",
    M: "101111111101101", N: "101111111111101", O: "010101101101010", P: "110101110100100",
    Q: "010101101011001", R: "110101110110101", S: "011100010001110", T: "111010010010010",
    U: "101101101101011", V: "101101101010010", W: "101101111111101", X: "101010010010101",
    Y: "101101010010010", Z: "111001010100111",
    "0": "010101101101010", "1": "010110010010111", "2": "110001010100111",
    "3": "110001010001110", "4": "101101111001001", "5": "111100110001110",
    "6": "011100110101010", "7": "111001010010010", "8": "010101010101010",
    "9": "010101011001110", "%": "101001010100101", "-": "000000111000000",
    ".": "000000000000010", ":": "000010000010000", " ": "000000000000000"
  };

  function text(g, str, x, y, color, a) {
    str = String(str).toUpperCase();
    for (var i = 0; i < str.length; i++) {
      var glyph = FONT[str[i]] || FONT[" "];
      for (var j = 0; j < 15; j++) {
        if (glyph[j] === "1") px(g, x + (j % 3), y + ((j / 3) | 0), color, a);
      }
      x += 4;
    }
  }
  function textWidth(str) { return String(str).length * 4 - 1; }

  // --- Baked tiles ----------------------------------------------------------------

  var sprites = {};

  function bakeFloorVariant(base, hi, lo, seed) {
    return bake(TILE, TILE, function (g) {
      rect(g, 0, 0, TILE, TILE, base);
      // speckle from the cell hash, so carpet never tiles visibly
      for (var i = 0; i < 14; i++) {
        var hx = (S.hash2(i, seed, 11) * TILE) | 0, hy = (S.hash2(seed, i, 23) * TILE) | 0;
        px(g, hx, hy, S.hash2(i, seed, 31) < 0.5 ? hi : lo, 0.5);
      }
      // seam line every tile edge, very faint
      rect(g, 0, 0, TILE, 1, lo, 0.25);
      rect(g, 0, 0, 1, TILE, lo, 0.25);
    });
  }

  function bakeAll() {
    var i;
    sprites.carpet = [];
    sprites.vinyl = [];
    for (i = 0; i < 4; i++) {
      sprites.carpet.push(bakeFloorVariant(P.carp1, P.carp2, P.carp0, i + 1));
      sprites.vinyl.push(bakeFloorVariant(P.vin1, P.vin2, P.vin0, i + 40));
    }

    sprites.wall = bake(TILE, TILE, function (g) {
      rect(g, 0, 0, TILE, TILE, P.wall1);
      rect(g, 0, TILE - 3, TILE, 3, P.wall0);            // skirting
      rect(g, 0, 0, TILE, 2, P.wall2);                   // cornice
      for (var j = 0; j < 5; j++) px(g, (S.hash2(j, 3, 7) * TILE) | 0, 3 + ((S.hash2(7, j, 9) * 9) | 0), P.wall2, 0.35);
    });

    sprites.windowFrame = bake(TILE, TILE, function (g) {
      rect(g, 0, 0, TILE, TILE, P.wall1);
      rect(g, 1, 1, TILE - 2, TILE - 4, P.wall0);        // recess — sky fills at draw time
      rect(g, 0, TILE - 3, TILE, 3, P.wall0);
      rect(g, 1, TILE - 4, TILE - 2, 1, P.wall3);        // sill
    });

    sprites.door = bake(TILE, TILE, function (g) {
      rect(g, 0, 0, TILE, TILE, P.wood1);
      frame(g, 1, 0, TILE - 2, TILE, P.wood0);
      rect(g, 3, 2, TILE - 6, TILE - 4, P.wood2);
      px(g, TILE - 5, TILE / 2, P.gold1);
    });

    // Desk: wood slab, monitor on top, keyboard. Screen area is repainted at
    // draw time (off / on / night glow).
    sprites.desk = bake(TILE, TILE + 6, function (g) {
      rect(g, 0, 10, TILE, 10, P.wood2);                 // desktop
      rect(g, 0, 10, TILE, 2, P.wood4);                  // lit edge
      rect(g, 1, 20, 2, 2, P.wood0); rect(g, TILE - 3, 20, 2, 2, P.wood0); // legs
      rect(g, 3, 1, 10, 8, P.metal1);                    // monitor shell
      frame(g, 3, 1, 10, 8, P.metal0);
      rect(g, 7, 9, 2, 1, P.metal0);                     // stand
      rect(g, 4, 12, 7, 2, P.metal2);                    // keyboard
    });
    sprites.deskScreen = { x: 4, y: 2, w: 8, h: 6 };     // repainted rect (canvas-local)

    sprites.chair = bake(TILE, TILE, function (g) {
      rect(g, 5, 8, 6, 5, P.metal1);
      rect(g, 5, 6, 6, 2, P.red1);
      rect(g, 7, 13, 2, 2, P.metal0);
    });

    sprites.table = bake(TILE * 3, TILE * 2, function (g) {
      rect(g, 2, 6, TILE * 3 - 4, TILE * 2 - 12, P.wood3);
      rect(g, 2, 6, TILE * 3 - 4, 2, P.wood4);
      frame(g, 2, 6, TILE * 3 - 4, TILE * 2 - 12, P.wood1);
      rect(g, 4, TILE * 2 - 6, 3, 3, P.wood0); rect(g, TILE * 3 - 7, TILE * 2 - 6, 3, 3, P.wood0);
      // scattered papers + laptop
      rect(g, 8, 10, 5, 4, P.bone); rect(g, 26, 14, 5, 4, P.bone, 0.9);
      rect(g, 17, 9, 7, 5, P.metal2); rect(g, 18, 10, 5, 3, P.screen1);
    });

    sprites.coffee = bake(TILE, TILE + 8, function (g) {
      rect(g, 2, 2, 12, 20, P.metal1);
      frame(g, 2, 2, 12, 20, P.metal0);
      rect(g, 4, 4, 8, 5, P.screen0);                    // menu panel
      px(g, 5, 5, P.screen2); px(g, 7, 5, P.screen2);
      rect(g, 5, 12, 6, 4, P.metal0);                    // dispenser
      px(g, 8, 16, P.red2);                              // the LED — rationed red
      rect(g, 4, 20, 8, 2, P.metal2);
    });

    sprites.cooler = bake(TILE, TILE + 6, function (g) {
      rect(g, 4, 10, 8, 11, P.metal2);
      frame(g, 4, 10, 8, 11, P.metal0);
      rect(g, 5, 2, 6, 8, P.blue2);                      // bottle
      rect(g, 6, 3, 2, 6, P.blue3);
      px(g, 5, 14, P.blue1); px(g, 10, 14, P.red1);      // taps
    });

    sprites.arcade = bake(TILE, TILE + 10, function (g) {
      rect(g, 2, 4, 12, 22, P.metal0);                   // cabinet
      rect(g, 2, 4, 12, 2, P.red2);                      // marquee
      rect(g, 4, 8, 8, 7, P.screen0);                    // screen (repainted live)
      rect(g, 3, 17, 10, 3, P.metal1);                   // control deck
      px(g, 5, 18, P.red2); px(g, 9, 18, P.gold2);       // buttons
      rect(g, 2, 24, 12, 2, P.metal1);
    });
    sprites.arcadeScreen = { x: 4, y: 8, w: 8, h: 7 };

    sprites.plant = bake(TILE, TILE + 6, function (g) {
      rect(g, 5, 15, 6, 6, P.orange1);                   // terracotta pot
      rect(g, 5, 15, 6, 1, P.orange2);
      // leaves
      px(g, 7, 4, P.leaf3); rect(g, 6, 5, 3, 2, P.leaf2);
      rect(g, 4, 7, 8, 3, P.leaf2); rect(g, 5, 10, 6, 3, P.leaf1);
      px(g, 3, 8, P.leaf1); px(g, 12, 8, P.leaf1);
      px(g, 5, 6, P.leaf3); px(g, 10, 9, P.leaf3);
    });

    // Agents: 10x14 body baked per colour ramp, 2 walk frames + idle + seated.
    var RAMPS = {
      noe: [0x8a4a12, 0xd97b25, 0xffb454],
      tibo: [0x2c6b33, 0x45a04a, 0x6be675],
      lisa: [0x3a5da8, 0x6f93d8, 0x8bb8ff]
    };
    sprites.agents = {};
    Object.keys(RAMPS).forEach(function (id) {
      var r = RAMPS[id];
      function body(g, legFrame, seated) {
        // head
        rect(g, 3, 0, 4, 3, P.hair2);
        rect(g, 3, 2, 4, 3, P.skin2);
        px(g, 3, 4, P.skin1); px(g, 6, 4, P.skin1);
        // torso in the agent's ramp — the saturated pixels in the frame
        rect(g, 2, 5, 6, 5, r[1]);
        rect(g, 2, 5, 6, 1, r[2]);
        rect(g, 2, 9, 6, 1, r[0]);
        px(g, 1, 6, r[1]); px(g, 8, 6, r[1]);            // arms
        if (seated) {
          rect(g, 2, 10, 6, 2, P.ink);                    // tucked legs
        } else if (legFrame === 0) {
          rect(g, 3, 10, 2, 4, P.ink); rect(g, 6, 10, 2, 3, P.ink);
        } else if (legFrame === 1) {
          rect(g, 3, 10, 2, 3, P.ink); rect(g, 6, 10, 2, 4, P.ink);
        } else {
          rect(g, 3, 10, 2, 4, P.ink); rect(g, 6, 10, 2, 4, P.ink);
        }
      }
      sprites.agents[id] = {
        idle: bake(10, 14, function (g) { body(g, 2, false); }),
        walk1: bake(10, 14, function (g) { body(g, 0, false); }),
        walk2: bake(10, 14, function (g) { body(g, 1, false); }),
        sit: bake(10, 12, function (g) { body(g, 0, true); }),
        ramp: r
      };
    });

    // Status icons, 7x7.
    sprites.icons = {
      coffee: bake(7, 7, function (g) {
        rect(g, 1, 2, 4, 4, P.bone); rect(g, 5, 3, 1, 2, P.bone);
        px(g, 2, 0, P.metal3); px(g, 3, 1, P.metal3);
      }),
      chat: bake(7, 7, function (g) {
        rect(g, 0, 0, 7, 5, P.bone); px(g, 1, 5, P.bone); px(g, 1, 6, P.bone);
        px(g, 2, 2, P.ink); px(g, 4, 2, P.ink);
      }),
      arcade: bake(7, 7, function (g) {
        rect(g, 0, 3, 7, 3, P.metal2); px(g, 2, 1, P.red2); rect(g, 2, 2, 1, 2, P.metal3); px(g, 5, 4, P.gold2);
      }),
      work: bake(7, 7, function (g) {
        rect(g, 1, 1, 5, 4, P.screen1); frame(g, 0, 0, 7, 6, P.metal2); px(g, 3, 6, P.metal2);
      })
    };
  }

  // --- Day/night ambience -----------------------------------------------------------

  /**
   * t in [0,1): 0 = 9am. Returns window sky colour and the ambient tint that
   * is skipped entirely when its alpha would be negligible (the AI-farm perf
   * lesson: don't pay fill rate for an invisible quad).
   */
  function ambience(t) {
    // keyframes over the office day: morning -> noon -> dusk -> night -> dawn
    var keys = [
      { at: 0.00, sky: P.skyDay, tint: 0x000000, a: 0.00 },
      { at: 0.30, sky: P.skyDay, tint: 0x000000, a: 0.00 },
      { at: 0.45, sky: P.skyDusk, tint: 0x2a1430, a: 0.14 },
      { at: 0.55, sky: P.skyNight, tint: 0x0a1030, a: 0.34 },
      { at: 0.80, sky: P.skyNight, tint: 0x0a1030, a: 0.34 },
      { at: 0.90, sky: P.skyDawn, tint: 0x30160a, a: 0.12 },
      { at: 1.00, sky: P.skyDay, tint: 0x000000, a: 0.00 }
    ];
    for (var i = 0; i < keys.length - 1; i++) {
      var k0 = keys[i], k1 = keys[i + 1];
      if (t >= k0.at && t <= k1.at) {
        var f = (t - k0.at) / (k1.at - k0.at || 1);
        return {
          sky: mix(k0.sky, k1.sky, f),
          tint: mix(k0.tint, k1.tint, f),
          alpha: k0.a + (k1.a - k0.a) * f,
          night: Math.min(1, Math.max(0, (k0.a + (k1.a - k0.a) * f) / 0.34))
        };
      }
    }
    return { sky: P.skyDay, tint: 0, alpha: 0, night: 0 };
  }

  // --- Scene drawing -------------------------------------------------------------------

  var world = null; // offscreen native-res canvas
  var wg = null;

  function init() {
    bakeAll();
    world = document.createElement("canvas");
    world.width = W; world.height = H;
    wg = world.getContext("2d");
    wg.imageSmoothingEnabled = false;
  }

  function statusIcon(agent) {
    if (agent.state === "coffee") return sprites.icons.coffee;
    if (agent.state === "chatting") return sprites.icons.chat;
    if (agent.state === "arcade") return sprites.icons.arcade;
    if (agent.state === "working") return sprites.icons.work;
    return null;
  }

  /** Draw one frame of the office at native res, then blit scaled. */
  function draw(displayCtx, state, opts) {
    var g = wg;
    var t = S.timeOfDay(state, opts && opts.timeOverride);
    var amb = ambience(t);
    var T = S.T, gridMap = S.MAP.grid;
    var x, y, tile;

    // floor + walls
    for (y = 0; y < S.ROWS; y++) {
      for (x = 0; x < S.COLS; x++) {
        tile = gridMap[y][x];
        var v = (S.hash2(x, y, 5) * 4) | 0;
        var isWork = y <= 8;
        g.drawImage((isWork ? sprites.carpet : sprites.vinyl)[v], x * TILE, y * TILE);
        if (tile === T.WALL) g.drawImage(sprites.wall, x * TILE, y * TILE);
        else if (tile === T.WINDOW) {
          g.drawImage(sprites.windowFrame, x * TILE, y * TILE);
          rect(g, x * TILE + 2, y * TILE + 2, TILE - 4, TILE - 6, amb.sky);
          // skyline pixels at night
          if (amb.night > 0.5) {
            for (var w2 = 0; w2 < 4; w2++) {
              if (S.hash2(x, w2, 77) < 0.4) px(g, x * TILE + 3 + w2 * 3, y * TILE + 8 + ((S.hash2(w2, x, 78) * 3) | 0), P.gold2, 0.8);
            }
          }
        } else if (tile === T.DOOR) g.drawImage(sprites.door, x * TILE, y * TILE);
      }
    }

    // rug seam between carpet and vinyl
    rect(g, TILE, 9 * TILE - 1, W - 2 * TILE, 2, P.wall0, 0.5);

    // furniture (draw order = y order; oversized sprites hang upward)
    S.MAP.desks.forEach(function (d, i) {
      g.drawImage(sprites.chair, d.x * TILE, (d.y + 1) * TILE);
      g.drawImage(sprites.desk, d.x * TILE, d.y * TILE - 6);
      // monitor screen: off by day-idle, on when its agent works, glow at night
      var a = state.agents[i];
      var scr = sprites.deskScreen;
      var on = a && (a.state === "working");
      var col = on ? (amb.night > 0.4 ? P.screen2 : P.screen1) : P.screen0;
      rect(g, d.x * TILE + scr.x, d.y * TILE - 6 + scr.y, scr.w, scr.h, col);
      if (on) { // one lit line of "code"
        rect(g, d.x * TILE + scr.x + 1, d.y * TILE - 6 + scr.y + 1 + ((state.tick >> 2) % (scr.h - 2)), scr.w - 3, 1, P.screen3, 0.9);
      }
    });

    g.drawImage(sprites.table, 20 * TILE, 3 * TILE);
    g.drawImage(sprites.coffee, S.MAP.coffee.x * TILE, S.MAP.coffee.y * TILE - 8);
    g.drawImage(sprites.cooler, S.MAP.cooler.x * TILE, S.MAP.cooler.y * TILE - 6);
    g.drawImage(sprites.arcade, S.MAP.arcade.x * TILE, S.MAP.arcade.y * TILE - 10);
    // arcade screen flickers when someone plays
    var playing = state.agents.some(function (a) { return a.state === "arcade"; });
    var asc = sprites.arcadeScreen;
    rect(g, S.MAP.arcade.x * TILE + asc.x, S.MAP.arcade.y * TILE - 10 + asc.y, asc.w, asc.h,
      playing ? [P.screen1, P.screen2, P.red2, P.gold2][(state.tick >> 1) & 3] : P.screen0);
    for (y = 0; y < S.ROWS; y++) for (x = 0; x < S.COLS; x++) {
      if (gridMap[y][x] === T.PLANT) g.drawImage(sprites.plant, x * TILE, y * TILE - 6);
    }

    // agents, painter-sorted by y
    var order = state.agents.slice().sort(function (a, b) { return a.y - b.y; });
    order.forEach(function (a) {
      var set = sprites.agents[a.id];
      if (!set) return;
      var spr;
      if (a.state === "working") spr = set.sit;
      else if (a.state === "walking") spr = ((state.tick >> 2) & 1) ? set.walk1 : set.walk2;
      else spr = set.idle;
      var ax = Math.round(a.x * TILE + (TILE - 10) / 2);
      var ay = Math.round(a.y * TILE + TILE - spr.height - 1);
      // soft shadow
      rect(g, ax + 1, a.y * TILE + TILE - 3, 8, 2, P.ink, 0.35);
      if (a.facing === -1) {
        g.save(); g.translate(ax + spr.width, ay); g.scale(-1, 1); g.drawImage(spr, 0, 0); g.restore();
      } else {
        g.drawImage(spr, ax, ay);
      }
      // name label in the bitmap font, ramp-coloured
      var label = a.name;
      var lx = Math.round(a.x * TILE + TILE / 2 - textWidth(label) / 2);
      var ly = ay - 7;
      rect(g, lx - 1, ly - 1, textWidth(label) + 2, 7, P.ink, 0.55);
      text(g, label, lx, ly, set.ramp[2]);
      // status icon
      var icon = statusIcon(a);
      if (icon) g.drawImage(icon, lx + textWidth(label) + 3, ly - 1);
    });

    // task progress bars above busy desks
    state.agents.forEach(function (a) {
      if (a.state !== "working" || a.taskId === null) return;
      var task = null;
      for (var i2 = 0; i2 < state.tasks.length; i2++) if (state.tasks[i2].id === a.taskId) { task = state.tasks[i2]; break; }
      if (!task) return;
      var bx = a.desk.x * TILE + 1, by = a.desk.y * TILE - 12;
      rect(g, bx, by, TILE - 2, 3, P.ink, 0.7);
      rect(g, bx + 1, by + 1, Math.max(1, ((TILE - 4) * task.progress / task.units) | 0), 1, P.gold2);
    });

    // ambient tint — skipped when invisible (fill-rate lesson from AI-farm)
    if (amb.alpha > 0.02) {
      rect(g, 0, 0, W, H, amb.tint, amb.alpha);
      // monitor + lamp glow cut through the dark
      g.globalCompositeOperation = "lighter";
      state.agents.forEach(function (a) {
        if (a.state !== "working") return;
        rect(g, a.desk.x * TILE - 4, a.desk.y * TILE - 6, TILE + 8, TILE + 10, P.screen1, 0.10 * amb.night);
      });
      rect(g, S.MAP.arcade.x * TILE - 3, S.MAP.arcade.y * TILE - 10, TILE + 6, TILE + 12, P.red1, 0.10 * amb.night);
      g.globalCompositeOperation = "source-over";
    }

    // clock chip, top-left
    var hour = ((9 + t * 24) % 24) | 0;
    var mins = ((t * 24 * 60) % 60) | 0;
    var clock = (hour < 10 ? "0" : "") + hour + ":" + (mins < 10 ? "0" : "") + mins;
    rect(g, 3, 3, textWidth(clock) + 6, 9, P.ink, 0.6);
    text(g, clock, 6, 5, P.bone);

    // blit to display, integer-friendly scale, centred
    var dc = displayCtx.canvas;
    displayCtx.imageSmoothingEnabled = false;
    displayCtx.clearRect(0, 0, dc.width, dc.height);
    displayCtx.drawImage(world, 0, 0, W, H, 0, 0, dc.width, dc.height);
  }

  return { TILE: TILE, W: W, H: H, P: P, init: init, draw: draw, ambience: ambience };
})();
