// Material definitions — raw inputs for manufacturing products
// Materials are a distinct inventory category from finished products (stickers, plushies, gacha)

export const MATERIALS = {
  sticker_paper:      { name: 'Sticker Paper',       stackMax: 20, price: 2, dailyStock: 30 },
  fabric_roll:        { name: 'Fabric Roll',          stackMax: 10, price: 8, dailyStock: 10 },
  stuffing:           { name: 'Stuffing',             stackMax: 15, price: 3, dailyStock: 15 },
  capsule_shell:      { name: 'Capsule Shell',        stackMax: 10, price: 5, dailyStock: 10 },
  thread_spool:       { name: 'Thread Spool',         stackMax: 20, price: 2, dailyStock: 20 },
  fabric_scrap:       { name: 'Fabric Scrap',         stackMax: 20, price: 0, dailyStock: 0 },
  plushie_pattern:    { name: 'Plushie Pattern',      stackMax: 15, price: 0, dailyStock: 0 },
  plushie_shell:      { name: 'Plushie Shell',        stackMax: 10, price: 0, dailyStock: 0 },
  plushie_shell_color:{ name: 'Color Plushie Shell',  stackMax: 10, price: 0, dailyStock: 0 },
  color_ink:          { name: 'Color Ink',            stackMax: 15, price: 8, dailyStock: 5 },
};

// Returns inline CSS style object for material icons in inventory slots
// All material icons are 22px (smaller than 28px product icons)
export function getMaterialIconStyle(subtype) {
  switch (subtype) {
    case 'sticker_paper':
      return {
        width: '22px', height: '22px',
        borderRadius: '2px',
        background: 'linear-gradient(135deg, #f0f0f0, #d8d8d8)',
        boxShadow: '0 0 6px rgba(255,255,255,0.2)',
        border: '1px solid rgba(255,255,255,0.3)',
      };
    case 'fabric_roll':
      return {
        width: '22px', height: '22px',
        borderRadius: '6px 6px 3px 3px',
        background: 'linear-gradient(180deg, #7a9cb8, #5a7c98)',
        boxShadow: '0 0 6px rgba(100,150,200,0.25)',
      };
    case 'stuffing':
      return {
        width: '22px', height: '22px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 35%, #ffffff, #e8e8e8)',
        boxShadow: '0 0 8px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(200,200,200,0.3)',
      };
    case 'capsule_shell':
      return {
        width: '22px', height: '22px',
        borderRadius: '50%',
        background: 'transparent',
        border: '2px solid rgba(200,200,200,0.5)',
        boxShadow: '0 0 6px rgba(200,200,200,0.15)',
      };
    case 'thread_spool':
      return {
        width: '22px', height: '22px',
        borderRadius: '3px',
        background: 'linear-gradient(180deg, #c8a870 15%, #a07848 20%, #e8c898 25%, #e8c898 75%, #a07848 80%, #c8a870 85%)',
        boxShadow: '0 0 6px rgba(200,170,120,0.25)',
      };
    case 'fabric_scrap':
      return {
        width: '20px', height: '18px',
        borderRadius: '2px 4px 2px 3px',
        background: 'linear-gradient(135deg, #6888a8, #506878)',
        boxShadow: '0 0 5px rgba(80,120,160,0.2)',
        transform: 'rotate(-8deg)',
      };
    case 'plushie_pattern':
      return {
        width: '22px', height: '22px',
        borderRadius: '1px',
        background: 'linear-gradient(135deg, #f5e8c8, #e0d0a8)',
        boxShadow: '0 0 6px rgba(240,220,160,0.3)',
        border: '1px dashed rgba(160,120,60,0.5)',
      };
    case 'plushie_shell':
      return {
        width: '22px', height: '22px',
        borderRadius: '50% 50% 45% 45%',
        background: 'radial-gradient(circle at 40% 35%, #ffcce0, #f0a0c0)',
        boxShadow: '0 0 8px rgba(240,120,180,0.3)',
        border: '1px solid rgba(220,100,160,0.4)',
      };
    case 'plushie_shell_color':
      return {
        width: '22px', height: '22px',
        borderRadius: '50% 50% 45% 45%',
        background: 'radial-gradient(circle at 40% 35%, #ffe060, #ff90e0)',
        boxShadow: '0 0 10px rgba(255,160,100,0.5)',
        border: '1px solid rgba(255,200,80,0.6)',
      };
    case 'color_ink':
      return {
        width: '22px', height: '22px',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 38% 32%, #ff80d0, #c030a0)',
        boxShadow: '0 0 10px rgba(200,50,180,0.5)',
        border: '1px solid rgba(255,100,220,0.5)',
      };
    default:
      return {
        width: '22px', height: '22px',
        borderRadius: '4px',
        background: '#888',
      };
  }
}

// Returns inline CSS style object for material drag ghost
export function getMaterialGhostStyle(subtype) {
  const base = getMaterialIconStyle(subtype);
  return {
    ...base,
    width: '34px', height: '34px',
    boxShadow: '0 0 16px rgba(200,200,200,0.4)',
  };
}
