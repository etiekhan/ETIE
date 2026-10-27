// Map style preparation for Etie - reads palette from CSS variables
// and applies neon-noir recoloring without hard-coding colors.
(function(){
  'use strict';

  var MAPTILER_KEY = (window.ETIE_CONFIG && window.ETIE_CONFIG.MAPTILER_API_KEY) || '';
  var STYLE_URL = 'public/map-style.json';

  // Read palette from CSS variables
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // Color classification by layer
  var PALETTE = {
    sea: cssVar('--sea'),
    land: cssVar('--land'),
    parks: cssVar('--parks'),
    amber: cssVar('--amber'),
    pink: cssVar('--pink'),
    violet: cssVar('--violet'),
    muted: cssVar('--muted'),
    ink: cssVar('--ink'),
    blue: cssVar('--blue'),
    red: cssVar('--red')
  };

  // Layer classification rules
  var LAYER_RULES = {
    // Background
    'Background': { type: 'background', color: 'sea' },
    // Landcover fills -> land
    'Meadow': { type: 'fill', color: 'land' },
    'Scrub': { type: 'fill', color: 'land' },
    'Crop': { type: 'fill', color: 'land' },
    'Forest': { type: 'fill', color: 'land' },
    'Sand': { type: 'fill', color: 'land' },
    'Wood': { type: 'fill', color: 'land' },
    'Glacier': { type: 'fill', color: 'land' },
    'Grass': { type: 'fill', color: 'land' },
    // Landuse fills -> land/parks
    'Pedestrian': { type: 'fill', color: 'land' },
    'Residential': { type: 'fill', color: 'land' },
    'Industrial': { type: 'fill', color: 'land' },
    'Cemetery': { type: 'fill', color: 'parks' },
    'Hospital': { type: 'fill', color: 'land' },
    'Stadium': { type: 'fill', color: 'land' },
    'School': { type: 'fill', color: 'land' },
    // Water -> sea
    'Water': { type: 'fill', color: 'sea' },
    'Water intermittent': { type: 'fill', color: 'sea' },
    'River': { type: 'line', color: 'sea' },
    'River tunnel': { type: 'line', color: 'sea' },
    'Aqueduct': { type: 'line', color: 'sea' },
    'Aqueduct outline': { type: 'line', color: 'sea' },
    'Pier': { type: 'fill', color: 'land' },
    'Pier road': { type: 'line', color: 'land' },
    // Roads
    'Minor road': { type: 'line', color: 'violet', opacity: 0.4 },
    'Minor road outline': { type: 'line', color: 'violet', opacity: 0.2 },
    'Major road': { type: 'line', color: 'amber', major: true },
    'Major road outline': { type: 'line', color: 'amber', major: true, outline: true },
    'Highway': { type: 'line', color: 'amber', major: true },
    'Highway outline': { type: 'line', color: 'amber', major: true, outline: true },
    'Bridge': { type: 'fill', color: 'land' },
    'Bridge outline': { type: 'line', color: 'amber', major: true },
    'Path': { type: 'line', color: 'violet', opacity: 0.3 },
    'Path minor': { type: 'line', color: 'violet', opacity: 0.2 },
    'Path outline': { type: 'line', color: 'violet', opacity: 0.2 },
    'Road under construction': { type: 'line', color: 'violet', opacity: 0.3 },
    'Tunnel': { type: 'line', color: 'pink', opacity: 0.6 },
    'Tunnel outline': { type: 'line', color: 'pink', opacity: 0.3 },
    'Footway tunnel': { type: 'line', color: 'violet', opacity: 0.3 },
    'Footway tunnel outline': { type: 'line', color: 'violet', opacity: 0.2 },
    // Rails
    'Major rail': { type: 'line', color: 'muted', opacity: 0.5 },
    'Major rail hatching': { type: 'line', color: 'muted', opacity: 0.3 },
    'Minor rail': { type: 'line', color: 'muted', opacity: 0.4 },
    'Minor rail hatching': { type: 'line', color: 'muted', opacity: 0.2 },
    'Railway tunnel': { type: 'line', color: 'muted', opacity: 0.4 },
    'Railway tunnel hatching': { type: 'line', color: 'muted', opacity: 0.2 },
    // Aeroway
    'Aeroway': { type: 'line', color: 'muted', opacity: 0.5 },
    'Heliport': { type: 'fill', color: 'land' },
    'Airport zone': { type: 'fill', color: 'land' },
    // Borders
    'Other border': { type: 'line', color: 'muted', opacity: 0.3 },
    'Disputed border': { type: 'line', color: 'muted', opacity: 0.3 },
    'Country border': { type: 'line', color: 'muted', opacity: 0.4 },
    // Cablecar
    'Cablecar': { type: 'line', color: 'muted', opacity: 0.5 },
    'Cablecar dash': { type: 'line', color: 'muted', opacity: 0.3 },
    'Ferry line': { type: 'line', color: 'muted', opacity: 0.4 },
    // Buildings - hide
    'Building': { type: 'fill', hide: true },
    'Building 3D': { type: 'fill-extrusion', hide: true },
    // POI layers - hide
    'Public': { type: 'symbol', hide: true },
    'Sport': { type: 'symbol', hide: true },
    'Education': { type: 'symbol', hide: true },
    'Tourism': { type: 'symbol', hide: true },
    'Culture': { type: 'symbol', hide: true },
    'Shopping': { type: 'symbol', hide: true },
    'Food': { type: 'symbol', hide: true },
    'Transport': { type: 'symbol', hide: true },
    'Park': { type: 'symbol', hide: true },
    'Healthcare': { type: 'symbol', hide: true },
    'Station': { type: 'symbol', hide: true },
    'Airport gate': { type: 'symbol', hide: true },
    'Airport': { type: 'symbol', hide: true },
    // Housenumber - hide
    'Housenumber': { type: 'symbol', hide: true },
  // Label layers -> muted with dark halo
    'River labels': { type: 'symbol', color: 'muted' },
    'Ocean labels': { type: 'symbol', color: 'muted' },
    'Lake labels': { type: 'symbol', color: 'muted' },
    'Gondola': { type: 'symbol', color: 'muted' },
    'Ferry': { type: 'symbol', color: 'muted' },
    'Oneway': { type: 'symbol', color: 'muted' },
    'Road labels': { type: 'symbol', color: 'muted' },
    'Highway junction': { type: 'symbol', color: 'muted' },
    'Highway shield': { type: 'symbol', color: 'muted' },
    'Highway shield (US)': { type: 'symbol', color: 'muted' },
    'Highway shield interstate top (US)': { type: 'symbol', color: 'muted' },
    'Highway shield interstate (US)': { type: 'symbol', color: 'muted' },
    'Place labels': { type: 'symbol', color: 'muted' },
    'State labels': { type: 'symbol', color: 'muted' },
    'Town labels': { type: 'symbol', color: 'muted' },
    'City labels': { type: 'symbol', color: 'muted' },
    'Capital city labels': { type: 'symbol', color: 'muted' },
    'Country labels': { type: 'symbol', color: 'muted' },
    'Continent labels': { type: 'symbol', color: 'muted' },
    // Highway shields - keep (road labels)
    // Place labels - handled separately
  };

  // Layers to hide entirely (POI, building, village, island labels)
  var HIDE_LAYERS = [
    'Building', 'Building 3D',
    'Public', 'Sport', 'Education', 'Tourism', 'Culture', 'Shopping', 'Food',
    'Transport', 'Park', 'Healthcare', 'Station', 'Airport gate', 'Airport',
    'Housenumber'
  ];

  // Label layers to recolor and set language
  var LABEL_LAYERS = [
    'River labels', 'Ocean labels', 'Lake labels', 'Road labels',
    'Highway junction', 'Highway shield', 'Highway shield (US)',
    'Highway shield interstate top (US)', 'Highway shield interstate (US)',
    'Gondola', 'Ferry', 'Oneway', 'Place labels',
    'State labels', 'Town labels', 'City labels', 'Capital city labels',
    'Country labels', 'Continent labels'
  ];

  // Major road layer ids (for glow duplication)
  var MAJOR_ROAD_LAYERS = ['Major road', 'Highway', 'Major road outline', 'Highway outline', 'Bridge', 'Bridge outline'];

  function applyColor(layer, rule) {
    if (!rule) return;
    if (rule.hide) {
      layer.layout = layer.layout || {};
      layer.layout.visibility = 'none';
      return;
    }
    var colorKey = rule.color;
    var color = PALETTE[colorKey];
    if (!color) return;

    if (layer.type === 'background') {
      layer.paint = layer.paint || {};
      layer.paint['background-color'] = color;
    } else if (layer.type === 'fill') {
      layer.paint = layer.paint || {};
      layer.paint['fill-color'] = color;
      if (layer.paint['fill-outline-color']) {
        layer.paint['fill-outline-color'] = PALETTE.ink;
      }
    } else if (layer.type === 'line') {
      layer.paint = layer.paint || {};
      layer.paint['line-color'] = color;
      if (rule.opacity !== undefined) {
        layer.paint['line-opacity'] = rule.opacity;
      }
    } else if (layer.type === 'symbol') {
      layer.paint = layer.paint || {};
      if (layer.paint['text-color']) {
        layer.paint['text-color'] = PALETTE.muted;
      }
      if (layer.paint['text-halo-color']) {
        layer.paint['text-halo-color'] = PALETTE.ink;
      }
      if (layer.paint['text-halo-blur'] !== undefined) {
        layer.paint['text-halo-blur'] = 1;
      }
      if (layer.paint['text-halo-width'] !== undefined) {
        layer.paint['text-halo-width'] = 2;
      }
      // Set English language
      if (layer.layout && layer.layout['text-field']) {
        layer.layout['text-field'] = ['coalesce', ['get', 'name:en'], ['get', 'name']];
      }
    }
  }

  function hideLayer(layer) {
    layer.layout = layer.layout || {};
    layer.layout.visibility = 'none';
  }

  function setEnglishLabels(layer) {
    if (layer.type !== 'symbol') return;
    if (!layer.layout) return;
    if (layer.layout['text-field']) {
      layer.layout['text-field'] = ['coalesce', ['get', 'name:en'], ['get', 'name']];
    }
  }

  function hideVillageIslandLabels(layer) {
    if (layer.type !== 'symbol') return;
    if (!layer.filter) return;
    // Place labels layer includes villages, islands, etc.
    if (layer.id === 'Place labels') {
      // Add village and island to exclusion list
      if (Array.isArray(layer.filter) && layer.filter[0] === '!in' && layer.filter[1] === 'class') {
        var excluded = layer.filter[2];
        if (Array.isArray(excluded)) {
          ['village', 'island', 'hamlet', 'locality', 'neighbourhood', 'suburb', 'quarter', 'isolated_dwelling'].forEach(function(cls) {
            if (excluded.indexOf(cls) === -1) excluded.push(cls);
          });
        }
      }
    }
  }

  function createGlowLayer(layer) {
    var glow = JSON.parse(JSON.stringify(layer));
    glow.id = layer.id + ' (glow)';
    glow.paint = glow.paint || {};
    // Wider
    if (glow.paint['line-width']) {
      var w = glow.paint['line-width'];
      if (typeof w === 'number') {
        glow.paint['line-width'] = w * 3;
      } else if (Array.isArray(w)) {
        // Interpolate array
        glow.paint['line-width'] = w.map(function(v) {
          if (typeof v === 'number') return v * 3;
          return v;
        });
      }
    }
    // Blur
    glow.paint['line-blur'] = 2;
    // Opacity
    glow.paint['line-opacity'] = 0.35;
    // Remove dasharray
    delete glow.paint['line-dasharray'];
    return glow;
  }

  function prepareStyle(style) {
    if (!style || !style.layers) return style;

    var newLayers = [];
    var layerMap = {};

    // First pass: classify and prepare layers
    style.layers.forEach(function(layer) {
      var rule = LAYER_RULES[layer.id];
      if (rule) {
        applyColor(layer, rule);
      }

      // Hide specific layers
      if (HIDE_LAYERS.indexOf(layer.id) !== -1) {
        hideLayer(layer);
      }

      // Hide village/island labels
      hideVillageIslandLabels(layer);

      // Set English labels
      setEnglishLabels(layer);

      // Add glow for major roads (insert before original)
      if (MAJOR_ROAD_LAYERS.indexOf(layer.id) !== -1) {
        var glow = createGlowLayer(layer);
        newLayers.push(glow);
      }

      newLayers.push(layer);
    });

    style.layers = newLayers;

    // Set attribution if not present
    if (style.sources) {
      Object.keys(style.sources).forEach(function(src) {
        if (style.sources[src] && !style.sources[src].attribution) {
          style.sources[src].attribution = '© MapTiler © OpenStreetMap contributors';
        }
      });
    }

    return style;
  }

  // Fetch and prepare style
  function loadStyle(callback) {
    fetch(STYLE_URL)
      .then(function(res) { return res.json(); })
      .then(function(style) {
        // Inject API key into URLs at runtime (key never stored in JSON)
        var key = MAPTILER_KEY;
        if (key) {
          if (style.sources) {
            Object.keys(style.sources).forEach(function(src) {
              if (style.sources[src].url && style.sources[src].url.indexOf('key=') === -1) {
                style.sources[src].url += '?key=' + encodeURIComponent(key);
              }
              if (style.sources[src].tiles) {
                style.sources[src].tiles = style.sources[src].tiles.map(function(t) {
                  return t.indexOf('key=') === -1 ? t + '?key=' + encodeURIComponent(key) : t;
                });
              }
            });
          }
          if (style.glyphs && style.glyphs.indexOf('key=') === -1) {
            style.glyphs = style.glyphs.replace('{key}', encodeURIComponent(key));
          }
          if (style.sprite && style.sprite.indexOf('key=') === -1) {
            style.sprite += '?key=' + encodeURIComponent(key);
          }
        }
        var prepared = prepareStyle(style);
        if (callback) callback(prepared);
      })
      .catch(function(err) {
        console.error('Failed to load map style:', err);
        if (callback) callback(null);
      });
  }

  // Expose globally
  window.EtieMapStyle = {
    load: loadStyle,
    prepare: prepareStyle,
    palette: PALETTE
  };
})();
