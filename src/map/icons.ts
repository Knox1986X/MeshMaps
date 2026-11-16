import type { Map as MlMap } from 'maplibre-gl';

/**
 * POI icons are drawn procedurally on a canvas and registered with map.addImage().
 * This keeps the app free of binary sprite assets and works fully offline.
 */
type Painter = (c: CanvasRenderingContext2D) => void;

const FG = '#e2e8f0';

function ring(c: CanvasRenderingContext2D, accent: string): void {
  c.beginPath();
  c.arc(32, 32, 29, 0, Math.PI * 2);
  c.fillStyle = '#0f172a';
  c.fill();
  c.lineWidth = 4;
  c.strokeStyle = accent;
  c.stroke();
}

function line(c: CanvasRenderingContext2D, w: number): void {
  c.strokeStyle = FG;
  c.lineWidth = w;
  c.lineCap = 'round';
  c.lineJoin = 'round';
}

const ICONS: Record<string, { accent: string; paint: Painter }> = {
  shop: {
    accent: '#38bdf8',
    paint: (c) => {
      line(c, 3.5);
      c.strokeRect(19, 27, 26, 20);
      c.beginPath();
      c.moveTo(26, 27);
      c.lineTo(26, 20);
      c.lineTo(38, 20);
      c.lineTo(38, 27);
      c.stroke();
    },
  },
  food: {
    accent: '#f97316',
    paint: (c) => {
      line(c, 3);
      c.beginPath();
      [22, 27, 32].forEach((x) => {
        c.moveTo(x, 17);
        c.lineTo(x, 26);
      });
      c.moveTo(22, 26);
      c.lineTo(32, 26);
      c.moveTo(27, 26);
      c.lineTo(27, 47);
      c.moveTo(43, 17);
      c.quadraticCurveTo(48, 24, 43, 31);
      c.lineTo(43, 47);
      c.stroke();
    },
  },
  cafe: {
    accent: '#f59e0b',
    paint: (c) => {
      line(c, 3.5);
      c.beginPath();
      c.moveTo(19, 24);
      c.lineTo(40, 24);
      c.lineTo(40, 37);
      c.quadraticCurveTo(40, 46, 31, 46);
      c.lineTo(28, 46);
      c.quadraticCurveTo(19, 46, 19, 37);
      c.closePath();
      c.stroke();
      c.beginPath();
      c.arc(40, 31, 4.5, -Math.PI / 2, Math.PI / 2);
      c.stroke();
      c.beginPath();
      c.moveTo(26, 17);
      c.quadraticCurveTo(23, 20, 26, 22);
      c.moveTo(33, 17);
      c.quadraticCurveTo(30, 20, 33, 22);
      c.stroke();
    },
  },
  bank: {
    accent: '#facc15',
    paint: (c) => {
      line(c, 3);
      c.beginPath();
      c.moveTo(16, 26);
      c.lineTo(32, 16);
      c.lineTo(48, 26);
      c.closePath();
      c.stroke();
      [21, 29, 37, 43].forEach((x) => {
        c.beginPath();
        c.moveTo(x, 30);
        c.lineTo(x, 42);
        c.stroke();
      });
      c.beginPath();
      c.moveTo(16, 47);
      c.lineTo(48, 47);
      c.stroke();
    },
  },
  pharmacy: {
    accent: '#34d399',
    paint: (c) => {
      c.fillStyle = FG;
      c.fillRect(28, 18, 8, 28);
      c.fillRect(18, 28, 28, 8);
    },
  },
  hospital: {
    accent: '#f472b6',
    paint: (c) => {
      c.fillStyle = '#f472b6';
      c.fillRect(28, 18, 8, 28);
      c.fillRect(18, 28, 28, 8);
    },
  },
  fuel: {
    accent: '#fbbf24',
    paint: (c) => {
      c.beginPath();
      c.moveTo(32, 16);
      c.bezierCurveTo(32, 16, 20, 32, 20, 39);
      c.arc(32, 39, 12, Math.PI, 0);
      c.bezierCurveTo(44, 32, 32, 16, 32, 16);
      c.closePath();
      c.fillStyle = FG;
      c.fill();
    },
  },
  bus: {
    accent: '#38bdf8',
    paint: (c) => {
      line(c, 3);
      c.strokeRect(18, 18, 28, 24);
      c.beginPath();
      c.moveTo(18, 27);
      c.lineTo(46, 27);
      c.stroke();
      c.fillStyle = FG;
      c.beginPath();
      c.arc(24, 46, 3.5, 0, Math.PI * 2);
      c.arc(40, 46, 3.5, 0, Math.PI * 2);
      c.fill();
    },
  },
  rail: {
    accent: '#a855f7',
    paint: (c) => {
      line(c, 3);
      c.strokeRect(21, 16, 22, 26);
      c.strokeRect(25, 20, 14, 8);
      c.beginPath();
      c.moveTo(21, 42);
      c.lineTo(17, 49);
      c.moveTo(43, 42);
      c.lineTo(47, 49);
      c.stroke();
    },
  },
  dot: {
    accent: '#38bdf8',
    paint: (c) => {
      c.beginPath();
      c.arc(32, 32, 9, 0, Math.PI * 2);
      c.fillStyle = FG;
      c.fill();
    },
  },
};

function render(key: string): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const c = canvas.getContext('2d');
  if (!c) throw new Error('2D canvas unavailable');
  const icon = ICONS[key];
  ring(c, icon.accent);
  icon.paint(c);
  return c.getImageData(0, 0, 64, 64);
}

export function registerIcons(map: MlMap): void {
  for (const key of Object.keys(ICONS)) {
    const id = `mm-${key}`;
    if (map.hasImage(id)) continue;
    map.addImage(id, render(key), { pixelRatio: 2 });
  }
}
