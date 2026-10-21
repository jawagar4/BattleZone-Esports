
import { useState } from 'react';
import { gameMeta } from '../services/games';

const GAME_IMAGES = {
  bgmi: 'https://www.google.com/imgres?q=free%20fire%20clash%20squad%20image&imgurl=https%3A%2F%2Fcdn-www.bluestacks.com%2Fbs-images%2F751_Garena-Free-Fire_Clash-Squad-Guide.jpg&imgrefurl=https%3A%2F%2Fwww.bluestacks.com%2Fblog%2Fgame-guides%2Ffree-fire-battlegrounds%2Fff-clash-squad-guide-en.html&docid=tvRhxs8OKacwmM&tbnid=1BDIIl3HISth3M&vet=12ahUKEwjRt4W3tsWXAxXZR2wGHX7YEYQQnPAOegQIORAA..i&w=1280&h=720&hcb=2&ved=2ahUKEwjRt4W3tsWXAxXZR2wGHX7YEYQQnPAOegQIORAA',
  freefire: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR5Ia5TzCNOmWlJfeAjW3rV_2XSvm_nXjQnQiQiEsC0Mw&s=10',
  valorant: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=900',
  cod: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=900',
};

const RANDOM_IMAGES = [
  'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=900',
  'https://images.unsplash.com/photo-1547394765-185e1e68f34e?w=900',
  'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=900',
  'https://images.unsplash.com/photo-1493711662062-fa541adb3fc8?w=900',
];

const DEFAULT_IMAGE = '/images/default-game.jpg';

export default function GameArt({
  game,
  className = '',
  style = {},
}) {
  const [failed, setFailed] = useState(false);
  const [fallbackFailed, setFallbackFailed] = useState(false);

  const meta = gameMeta(game);
  const key = String(meta?.art || game || '').toLowerCase();

  // Pick a random image for unknown game names.
  const randomImage =
    RANDOM_IMAGES[Math.floor(Math.random() * RANDOM_IMAGES.length)];

  const imageSrc = GAME_IMAGES[key] || randomImage;

  const src = failed
    ? fallbackFailed
      ? undefined
      : DEFAULT_IMAGE
    : imageSrc;

  return (
    <img
      src={src}
      alt={`${game || 'Game'} artwork`}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        display: 'block',
        ...style,
      }}
      loading="lazy"
      onError={() => {
        if (!failed) {
          setFailed(true);
        } else {
          setFallbackFailed(true);
        }
      }}
    />
  );
}
