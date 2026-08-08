/** "Montage" automatique : dispose les photos d'un post en collage selon leur nombre, sans
 * traitement d'image (juste une grille CSS) — 1 photo pleine largeur, 2 côte à côte, 3 en L,
 * 4+ en grille avec un "+N" sur la dernière tuile s'il y en a davantage. */
export function PhotoCollage({ urls, onPhotoClick }: { urls: string[]; onPhotoClick?: (index: number) => void }) {
  if (urls.length === 0) return null;

  if (urls.length === 1) {
    return (
      <button type="button" onClick={() => onPhotoClick?.(0)} className="block w-full overflow-hidden rounded-lg">
        <img src={urls[0]} alt="" className="aspect-[4/3] w-full object-cover" />
      </button>
    );
  }

  if (urls.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-1 overflow-hidden rounded-lg">
        {urls.map((u, i) => (
          <button key={i} type="button" onClick={() => onPhotoClick?.(i)} className="block">
            <img src={u} alt="" className="aspect-square w-full object-cover" />
          </button>
        ))}
      </div>
    );
  }

  if (urls.length === 3) {
    return (
      <div className="grid grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-lg" style={{ aspectRatio: "4 / 3" }}>
        <button type="button" onClick={() => onPhotoClick?.(0)} className="row-span-2 block h-full w-full">
          <img src={urls[0]} alt="" className="h-full w-full object-cover" />
        </button>
        <button type="button" onClick={() => onPhotoClick?.(1)} className="block h-full w-full">
          <img src={urls[1]} alt="" className="h-full w-full object-cover" />
        </button>
        <button type="button" onClick={() => onPhotoClick?.(2)} className="block h-full w-full">
          <img src={urls[2]} alt="" className="h-full w-full object-cover" />
        </button>
      </div>
    );
  }

  const shown = urls.slice(0, 4);
  const extra = urls.length - 4;
  return (
    <div className="grid grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-lg" style={{ aspectRatio: "1 / 1" }}>
      {shown.map((u, i) => (
        <button key={i} type="button" onClick={() => onPhotoClick?.(i)} className="relative block h-full w-full">
          <img src={u} alt="" className="h-full w-full object-cover" />
          {i === 3 && extra > 0 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
              +{extra}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
