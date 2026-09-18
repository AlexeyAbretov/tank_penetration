import Phaser from 'phaser';

function bake(
  scene: Phaser.Scene,
  key: string,
  width: number,
  height: number,
  draw: (g: Phaser.GameObjects.Graphics) => void,
): void {
  const g = scene.add.graphics();
  draw(g);
  g.generateTexture(key, width, height);
  g.destroy();
}

function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createTextures(scene: Phaser.Scene): void {
  createBattlefield(scene);
  createTankHull(scene);
  createTankTurret(scene);
  createInfantry(scene);
  createGunner(scene);
  createPickup(scene);
  createShell(scene);
  createEnemyBullet(scene);
  createMuzzle(scene);
  createParticles(scene);
  createBanner(scene);
  createHpFrame(scene);
}

export function ensureRuntimeTextures(scene: Phaser.Scene): void {
  if (!scene.textures.exists('gunner-0')) {
    createGunner(scene);
  }
  if (!scene.textures.exists('pickup-0')) {
    createPickup(scene);
  }
  if (!scene.textures.exists('enemy-bullet')) {
    createEnemyBullet(scene);
  }
}

function createBattlefield(scene: Phaser.Scene): void {
  bake(scene, 'battlefield', 1280, 720, (g) => {
    const rand = mulberry32(0x7a12f3);

    g.fillStyle(0x2a0a08);
    g.fillRect(0, 0, 1280, 720);

    g.fillStyle(0x4a140c);
    g.fillRect(0, 70, 1280, 650);

    g.fillStyle(0x5c1c10);
    g.fillEllipse(900, 180, 900, 160);

    for (let i = 0; i < 90; i += 1) {
      const x = 180 + rand() * 1100;
      const y = 90 + rand() * 560;
      const w = 30 + rand() * 140;
      const h = 16 + rand() * 70;
      g.fillStyle(rand() > 0.5 ? 0x3a120c : 0x6a2414, 0.55 + rand() * 0.35);
      g.fillEllipse(x, y, w, h);
    }

    for (let i = 0; i < 28; i += 1) {
      const x = 260 + rand() * 980;
      const y = 110 + rand() * 500;
      const w = 18 + rand() * 70;
      const h = 10 + rand() * 28;
      g.fillStyle(0x2a0c08, 0.45);
      g.fillEllipse(x, y, w, h);
    }

    const cracks = [
      [280, 160, 420, 210, 560, 190, 720, 250],
      [500, 320, 640, 360, 800, 340, 980, 400],
      [340, 480, 510, 510, 690, 490, 860, 540],
      [900, 140, 1040, 200, 1180, 170],
      [700, 80, 860, 120, 1020, 90, 1200, 130],
      [400, 380, 470, 430, 540, 410],
    ];

    for (const crack of cracks) {
      const draw = (width: number, color: number, alpha: number) => {
        g.lineStyle(width, color, alpha);
        g.beginPath();
        g.moveTo(crack[0], crack[1]);
        for (let i = 2; i < crack.length; i += 2) {
          g.lineTo(crack[i], crack[i + 1]);
        }
        g.strokePath();
      };
      draw(18, 0x1a0604, 0.95);
      draw(12, 0xff3300, 0.95);
      draw(6, 0xffaa22, 1);
      draw(2, 0xfff2aa, 0.9);
    }

    g.fillStyle(0xff6600, 0.55);
    g.fillEllipse(1080, 90, 420, 70);
    g.fillStyle(0xff2200, 0.35);
    g.fillEllipse(640, 40, 900, 50);

    for (let i = 0; i < 40; i += 1) {
      g.fillStyle(0xc45a2a, 0.35 + rand() * 0.4);
      g.fillCircle(200 + rand() * 1050, 100 + rand() * 530, 1 + rand() * 3);
    }
  });
}

function createTankHull(scene: Phaser.Scene): void {
  bake(scene, 'tank-hull', 176, 110, (g) => {
    g.fillStyle(0x000000, 0.35);
    g.fillEllipse(90, 96, 150, 22);

    g.fillStyle(0x1a1c16);
    g.fillRoundedRect(18, 58, 148, 38, 8);

    for (let i = 0; i < 6; i += 1) {
      const x = 36 + i * 22;
      g.fillStyle(0x2a2c24);
      g.fillCircle(x, 78, 11);
      g.fillStyle(0x4a4c42);
      g.fillCircle(x, 78, 7);
      g.fillStyle(0x1a1c16);
      g.fillCircle(x, 78, 3);
    }

    g.fillStyle(0x3d4a28);
    g.fillRoundedRect(22, 28, 140, 44, 8);
    g.fillStyle(0x556338);
    g.fillRoundedRect(28, 32, 128, 18, 6);
    g.fillStyle(0x2a341c);
    g.fillRoundedRect(30, 50, 124, 16, 4);

    g.fillStyle(0x2f3a22);
    g.fillTriangle(150, 32, 168, 50, 150, 68);
    g.fillStyle(0x4a5830);
    g.fillRect(148, 40, 16, 14);

    g.fillStyle(0x1e2416);
    g.fillRect(28, 36, 22, 10);
    g.fillRect(28, 48, 22, 4);
    g.lineStyle(1, 0x0e120a, 1);
    for (let i = 0; i < 4; i += 1) {
      g.lineBetween(30, 38 + i * 2, 48, 38 + i * 2);
    }

    g.fillStyle(0x6a4a22);
    g.fillCircle(78, 46, 4);
    g.fillCircle(108, 46, 4);

    g.fillStyle(0x2a2e22);
    g.fillRect(20, 62, 8, 18);
    g.fillRect(156, 64, 10, 14);
  });
}

function createTankTurret(scene: Phaser.Scene): void {
  bake(scene, 'tank-turret', 168, 48, (g) => {
    g.fillStyle(0x2c341c);
    g.fillRoundedRect(8, 8, 70, 32, 12);
    g.fillStyle(0x556338);
    g.fillRoundedRect(12, 12, 62, 16, 8);
    g.fillStyle(0x3d4a28);
    g.fillCircle(42, 24, 14);
    g.fillStyle(0x1e2416);
    g.fillCircle(42, 24, 6);
    g.fillStyle(0x6a7a48);
    g.fillCircle(42, 22, 3);

    g.fillStyle(0x2a2e22);
    g.fillRoundedRect(70, 16, 22, 16, 4);

    g.fillStyle(0x1a1c16);
    g.fillRoundedRect(88, 18, 68, 12, 3);
    g.fillStyle(0x3a3e32);
    g.fillRoundedRect(90, 20, 64, 8, 2);
    g.fillStyle(0x2a2e22);
    g.fillRect(152, 16, 10, 16);
    g.fillStyle(0x1a1c16);
    g.fillRect(156, 18, 6, 12);
    g.fillStyle(0x8a8e80);
    g.fillRect(160, 21, 4, 6);
  });
}

type SoldierLook = {
  pants: number;
  tunic: number;
  vest: number;
  helmet: number;
  helmetLight: number;
  longRifle: boolean;
};

function drawSoldier(g: Phaser.GameObjects.Graphics, legPhase: 0 | 1, look: SoldierLook): void {
  g.fillStyle(0x000000, 0.4);
  g.fillEllipse(32, 76, 36, 10);

  const backLegX = legPhase === 0 ? 22 : 36;
  const frontLegX = legPhase === 0 ? 36 : 22;

  g.fillStyle(0x1a120c);
  g.fillRoundedRect(backLegX - 2, 48, 14, 26, 4);
  g.fillStyle(look.pants);
  g.fillRoundedRect(backLegX, 50, 10, 22, 3);
  g.fillStyle(0x2a1c12);
  g.fillRoundedRect(backLegX - 2, 68, 14, 8, 2);

  g.fillStyle(0x1a120c);
  g.fillRoundedRect(frontLegX - 2, 48, 14, 26, 4);
  g.fillStyle(look.tunic);
  g.fillRoundedRect(frontLegX, 50, 10, 22, 3);
  g.fillStyle(0x2a1c12);
  g.fillRoundedRect(frontLegX - 2, 68, 14, 8, 2);

  g.fillStyle(0x1a120c);
  g.fillRoundedRect(16, 26, 34, 30, 8);
  g.fillStyle(look.tunic);
  g.fillRoundedRect(20, 28, 26, 26, 6);
  g.fillStyle(look.vest);
  g.fillRect(22, 40, 22, 7);
  g.fillStyle(0x5a3a18);
  g.fillRect(24, 34, 18, 5);

  g.fillStyle(look.tunic);
  g.fillRoundedRect(14, 30, 10, 18, 3);
  g.fillRoundedRect(40, 32, 10, 16, 3);

  g.fillStyle(0x1a120c);
  g.fillRoundedRect(look.longRifle ? 0 : 4, 34, look.longRifle ? 48 : 40, 8, 3);
  g.fillStyle(0x3a3228);
  g.fillRoundedRect(look.longRifle ? 2 : 6, 36, look.longRifle ? 44 : 36, 5, 2);
  g.fillStyle(0x6a6248);
  g.fillRect(look.longRifle ? 2 : 6, 37, 12, 3);
  g.fillStyle(0x1a1c16);
  g.fillRect(look.longRifle ? 0 : 2, 34, 8, 8);

  g.fillStyle(0x1a120c);
  g.fillCircle(32, 22, 10);
  g.fillStyle(0xe8c49a);
  g.fillCircle(32, 22, 8);
  g.fillStyle(0x1a120c);
  g.fillRoundedRect(20, 8, 24, 16, 5);
  g.fillStyle(look.helmet);
  g.fillRoundedRect(22, 10, 20, 14, 4);
  g.fillStyle(look.helmetLight);
  g.fillRect(24, 12, 10, 3);
  g.fillStyle(0x1a1e18);
  g.fillRect(22, 20, 20, 3);
  g.fillStyle(0x8a9a58);
  g.fillRect(38, 14, 6, 6);
}

const assaultLook: SoldierLook = {
  pants: 0x6a5238,
  tunic: 0xc4a36a,
  vest: 0x8a5a28,
  helmet: 0x4a5a30,
  helmetLight: 0xdde8a8,
  longRifle: false,
};

const gunnerLook: SoldierLook = {
  pants: 0x2a3a32,
  tunic: 0x4a5a52,
  vest: 0x1a2a22,
  helmet: 0x2a3a28,
  helmetLight: 0x8ab0c8,
  longRifle: true,
};

function createInfantry(scene: Phaser.Scene): void {
  bake(scene, 'infantry-0', 64, 80, (g) => drawSoldier(g, 0, assaultLook));
  bake(scene, 'infantry-1', 64, 80, (g) => drawSoldier(g, 1, assaultLook));
}

function createGunner(scene: Phaser.Scene): void {
  bake(scene, 'gunner-0', 64, 80, (g) => drawSoldier(g, 0, gunnerLook));
  bake(scene, 'gunner-1', 64, 80, (g) => drawSoldier(g, 1, gunnerLook));
}

function drawPickup(g: Phaser.GameObjects.Graphics, wheelPhase: 0 | 1): void {
  g.fillStyle(0x000000, 0.35);
  g.fillEllipse(84, 74, 128, 12);

  const body = 0x5a6a38;
  const bodyDark = 0x3a4a24;
  const metal = 0x2a2e22;

  g.fillStyle(metal);
  g.fillRoundedRect(14, 50, 136, 10, 3);

  g.fillStyle(body);
  g.fillRoundedRect(16, 40, 38, 20, 4);
  g.fillStyle(bodyDark);
  g.fillRect(18, 48, 34, 5);
  g.fillStyle(0x1a1c16);
  g.fillRect(12, 46, 8, 14);
  g.fillStyle(0xd8d080);
  g.fillCircle(15, 50, 3);

  g.fillStyle(bodyDark);
  g.fillRoundedRect(90, 34, 56, 26, 3);
  g.fillStyle(0x4a5a30);
  g.fillRect(92, 38, 52, 8);
  g.fillStyle(0x2a341c);
  g.fillRect(92, 44, 52, 4);
  g.fillStyle(metal);
  g.fillRect(90, 32, 56, 4);
  g.fillRect(90, 32, 4, 22);
  g.fillRect(142, 32, 4, 22);
  g.fillStyle(bodyDark);
  g.fillRect(144, 34, 6, 26);

  g.fillStyle(0x2a341c);
  g.fillRoundedRect(50, 14, 42, 46, 5);
  g.fillStyle(body);
  g.fillRoundedRect(52, 16, 38, 42, 4);
  g.fillStyle(bodyDark);
  g.fillRect(54, 40, 34, 8);

  g.fillStyle(0x1a3040);
  g.fillRoundedRect(54, 20, 22, 16, 3);
  g.fillStyle(0x88c8e0, 0.9);
  g.fillRoundedRect(56, 22, 18, 12, 2);
  g.fillStyle(0xffffff, 0.35);
  g.fillRect(58, 24, 6, 4);
  g.fillStyle(0x88c8e0, 0.7);
  g.fillRoundedRect(78, 22, 10, 12, 2);

  g.fillStyle(0x2a2218);
  g.fillCircle(118, 26, 7);
  g.fillStyle(0x3a4a28);
  g.fillRect(112, 30, 14, 14);

  g.fillStyle(0x2a2a26);
  g.fillRect(112, 16, 7, 16);
  g.fillStyle(0x1a1a16);
  g.fillRoundedRect(20, 18, 98, 5, 2);
  g.fillStyle(0x4a4a42);
  g.fillRect(20, 18, 10, 5);
  g.fillStyle(0x6a6a60);
  g.fillCircle(24, 20, 3);

  const spoke = wheelPhase === 0 ? 0 : 0.5;
  const drawWheel = (cx: number) => {
    g.fillStyle(0x1a1a16);
    g.fillCircle(cx, 62, 14);
    g.fillStyle(0x3a3a32);
    g.fillCircle(cx, 62, 9);
    g.fillStyle(0x1a1a16);
    g.fillCircle(cx, 62, 3);
    g.lineStyle(2, 0x8a8a80, 1);
    g.beginPath();
    g.moveTo(cx + Math.cos(spoke) * 8, 62 + Math.sin(spoke) * 8);
    g.lineTo(cx - Math.cos(spoke) * 8, 62 - Math.sin(spoke) * 8);
    g.moveTo(cx + Math.cos(spoke + 1.2) * 8, 62 + Math.sin(spoke + 1.2) * 8);
    g.lineTo(cx - Math.cos(spoke + 1.2) * 8, 62 - Math.sin(spoke + 1.2) * 8);
    g.strokePath();
  };
  drawWheel(40);
  drawWheel(126);
}

function createPickup(scene: Phaser.Scene): void {
  bake(scene, 'pickup-0', 160, 80, (g) => drawPickup(g, 0));
  bake(scene, 'pickup-1', 160, 80, (g) => drawPickup(g, 1));
}

function createEnemyBullet(scene: Phaser.Scene): void {
  bake(scene, 'enemy-bullet', 18, 8, (g) => {
    g.fillStyle(0xffee88);
    g.fillRoundedRect(0, 1, 18, 6, 2);
    g.fillStyle(0xffffff);
    g.fillRect(12, 2, 5, 4);
  });
}

function createShell(scene: Phaser.Scene): void {
  bake(scene, 'shell', 54, 22, (g) => {
    g.fillStyle(0xff2200, 0.35);
    g.fillEllipse(27, 11, 54, 22);
    g.fillStyle(0xff6600, 0.8);
    g.fillEllipse(30, 11, 40, 14);
    g.fillStyle(0xffee66);
    g.fillEllipse(34, 11, 26, 8);
    g.fillStyle(0xffffff);
    g.fillEllipse(40, 11, 12, 4);
  });
}

function createMuzzle(scene: Phaser.Scene): void {
  bake(scene, 'muzzle', 48, 48, (g) => {
    g.fillStyle(0xffaa44, 0.5);
    g.fillCircle(24, 24, 22);
    g.fillStyle(0xffee88, 0.9);
    g.fillCircle(24, 24, 12);
    g.fillStyle(0xffffff);
    g.fillCircle(24, 24, 5);
  });
}

function createParticles(scene: Phaser.Scene): void {
  bake(scene, 'spark', 12, 12, (g) => {
    g.fillStyle(0xffffff);
    g.fillCircle(6, 6, 5);
  });
  bake(scene, 'ember', 8, 8, (g) => {
    g.fillStyle(0xff6622);
    g.fillCircle(4, 4, 3);
  });
}

function createBanner(scene: Phaser.Scene): void {
  bake(scene, 'banner', 1280, 86, (g) => {
    g.fillStyle(0x5a0c0c);
    g.fillRect(0, 8, 1280, 78);
    g.fillStyle(0x8a1810);
    g.fillRect(0, 14, 1280, 62);

    g.lineStyle(6, 0xc9a227, 1);
    g.strokeRect(8, 10, 1264, 70);
    g.lineStyle(2, 0xf0d56a, 1);
    g.strokeRect(16, 16, 1248, 58);

    for (let x = 40; x < 1240; x += 48) {
      g.fillStyle(0xf0d56a);
      g.fillCircle(x, 12, 3);
      g.fillCircle(x, 78, 3);
    }
  });
}

function createHpFrame(scene: Phaser.Scene): void {
  bake(scene, 'hp-frame', 280, 28, (g) => {
    g.fillStyle(0x1a1a1e);
    g.fillRoundedRect(0, 4, 280, 20, 8);
    g.lineStyle(2, 0x8a8680, 1);
    g.strokeRoundedRect(0, 4, 280, 20, 8);
    g.fillStyle(0xa11a1a);
    g.fillTriangle(268, 0, 280, 14, 256, 14);
    g.fillStyle(0x6a1212);
    g.fillCircle(12, 14, 8);
    g.fillStyle(0xe04040);
    g.fillCircle(12, 14, 4);
  });
}

export function createAnimations(scene: Phaser.Scene): void {
  if (!scene.anims.exists('infantry-walk')) {
    scene.anims.create({
      key: 'infantry-walk',
      frames: [{ key: 'infantry-0' }, { key: 'infantry-1' }],
      frameRate: 7,
      repeat: -1,
    });
  }
  if (!scene.anims.exists('gunner-walk')) {
    scene.anims.create({
      key: 'gunner-walk',
      frames: [{ key: 'gunner-0' }, { key: 'gunner-1' }],
      frameRate: 7,
      repeat: -1,
    });
  }
  if (!scene.anims.exists('pickup-drive')) {
    scene.anims.create({
      key: 'pickup-drive',
      frames: [{ key: 'pickup-0' }, { key: 'pickup-1' }],
      frameRate: 8,
      repeat: -1,
    });
  }
}
