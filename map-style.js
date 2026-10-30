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

  // Layer classification rules (outdoor-v2 style)
  var LAYER_RULES = {
    // Background
    'Background': { type: 'background', color: 'sea' },
    // Landcover fills -> land/parks
    'Scrub': { type: 'fill', color: 'land' },
    'Tree': { type: 'fill', color: 'parks' },
    'Forest': { type: 'fill', color: 'parks' },
    'Wood': { type: 'fill', color: 'land' },
    'Grass': { type: 'fill', color: 'parks' },
    'Sand': { type: 'fill', color: 'land' },
    'Glacier': { type: 'fill', color: 'land' },
    // Landuse fills -> land
    'Residential': { type: 'fill', color: 'land' },
    'Industrial': { type: 'fill', color: 'land' },
    'Commercial': { type: 'fill', color: 'land' },
    'Military': { type: 'fill', color: 'land' },
    'Cemetery': { type: 'fill', color: 'parks' },
    'Hospital': { type: 'fill', color: 'land' },
    'Stadium': { type: 'fill', color: 'land' },
    // Hillshade - keep as is (terrain data)
    'Hillshade': { type: 'hillshade', keep: true },
    // Parks
    'Park': { type: 'fill', color: 'parks' },
    'Park outline': { type: 'line', color: 'parks' },
    // Contours - keep as is (terrain data)
    'Contour index': { type: 'line', color: 'muted', opacity: 0.4 },
    'Contour': { type: 'line', color: 'muted', opacity: 0.2 },
    'Glacier contour index': { type: 'line', color: 'muted', opacity: 0.4 },
    'Glacier contour': { type: 'line', color: 'muted', opacity: 0.2 },
    'Contour labels': { type: 'symbol', color: 'muted' },
    'Glacier contour labels': { type: 'symbol', color: 'muted' },
    // Water -> sea
    'River tunnel': { type: 'line', color: 'sea' },
    'River': { type: 'line', color: 'sea' },
    'Water': { type: 'fill', color: 'sea' },
    // Aeroway
    'Aeroway': { type: 'line', color: 'land' },
    'Runway': { type: 'line', color: 'land' },
    'Taxiway': { type: 'line', color: 'land' },
    // Transportation
    'Ferry': { type: 'line', color: 'muted', opacity: 0.5 },
    'Tunnel path': { type: 'line', color: 'pink', opacity: 0.6 },
    'Tunnel': { type: 'line', color: 'pink', opacity: 0.6 },
    'Railway tunnel': { type: 'line', color: 'muted', opacity: 0.5 },
    'Railway tunnel dash': { type: 'line', color: 'muted', opacity: 0.3 },
    'Bridge': { type: 'fill', color: 'land' },
    'Pier': { type: 'fill', color: 'land' },
    // Road network - handled specially (data-driven)
    'Road network': { type: 'line', color: 'amber', roadNetwork: true },
    'Steps': { type: 'line', color: 'violet', opacity: 0.4 },
    'Track': { type: 'line', color: 'violet', opacity: 0.4 },
    'Path minor': { type: 'line', color: 'violet', opacity: 0.3 },
    'Path': { type: 'line', color: 'violet', opacity: 0.4 },
    'Pedestrian outline': { type: 'line', color: 'violet', opacity: 0.3 },
    'Pedestrian': { type: 'line', color: 'violet', opacity: 0.4 },
    // Railways
    'Minor railway': { type: 'line', color: 'muted', opacity: 0.4 },
    'Minor railway hatching': { type: 'line', color: 'muted', opacity: 0.2 },
    'Major railway': { type: 'line', color: 'muted', opacity: 0.5 },
    'Major railway dash': { type: 'line', color: 'muted', opacity: 0.3 },
    // Trails
    'Trails outline': { type: 'line', color: 'violet', opacity: 0.3 },
    'Bicycle outline': { type: 'line', color: 'violet', opacity: 0.3 },
    'Other trails': { type: 'line', color: 'violet', opacity: 0.3 },
    'Bicycle local': { type: 'line', color: 'violet', opacity: 0.4 },
    'Yellow trail': { type: 'line', color: 'amber', opacity: 0.6 },
    'Green trail': { type: 'line', color: 'parks', opacity: 0.6 },
    'Blue trail': { type: 'line', color: 'blue', opacity: 0.6 },
    'Brown trail': { type: 'line', color: 'land', opacity: 0.6 },
    'Black trail': { type: 'line', color: 'ink', opacity: 0.6 },
    'Purple trail': { type: 'line', color: 'violet', opacity: 0.6 },
    'Orange trail': { type: 'line', color: 'amber', opacity: 0.6 },
    'Red trail': { type: 'line', color: 'red', opacity: 0.6 },
    'Longdistance trail outline': { type: 'line', color: 'violet', opacity: 0.3 },
    'Longdistance trail': { type: 'line', color: 'violet', opacity: 0.5 },
    'Via ferrata outline': { type: 'line', color: 'violet', opacity: 0.3 },
    'Via ferrata': { type: 'line', color: 'violet', opacity: 0.5 },
    'Via ferrata symbol': { type: 'symbol', color: 'muted' },
    'Bicycle longdistance': { type: 'line', color: 'violet', opacity: 0.5 },
    // Lifts
    'Minor lift': { type: 'line', color: 'muted', opacity: 0.4 },
    'Minor lift dash': { type: 'line', color: 'muted', opacity: 0.2 },
    'Chair lift': { type: 'line', color: 'muted', opacity: 0.4 },
    'Chair lift dash': { type: 'line', color: 'muted', opacity: 0.2 },
    'Cable car': { type: 'line', color: 'muted', opacity: 0.4 },
    'Cable car dash': { type: 'line', color: 'muted', opacity: 0.2 },
    // Military
    'Military limit': { type: 'line', color: 'muted', opacity: 0.3 },
    'Cliff line': { type: 'line', color: 'muted', opacity: 0.4 },
    'Cliff': { type: 'line', color: 'muted', opacity: 0.4 },
    // Borders
    'Other border': { type: 'line', color: 'muted', opacity: 0.3 },
    'Disputed border': { type: 'line', color: 'muted', opacity: 0.3 },
    'Country border': { type: 'line', color: 'muted', opacity: 0.4 },
    // Building - hide
    'Building': { type: 'fill', hide: true },
    // Labels - handled separately
    'River labels': { type: 'symbol', color: 'sea' },
    'Lakeline labels': { type: 'symbol', color: 'muted' },
    'Ocean labels': { type: 'symbol', color: 'muted' },
    'Sea labels': { type: 'symbol', color: 'muted' },
    'Lake labels': { type: 'symbol', color: 'muted' },
    'Aerialway labels': { type: 'symbol', color: 'muted' },
    'Road labels': { type: 'symbol', color: 'muted' },
    'Volcano labels (US)': { type: 'symbol', color: 'muted' },
    'Volcano labels': { type: 'symbol', color: 'muted' },
    'Peak labels (US)': { type: 'symbol', color: 'muted' },
    'Peak labels': { type: 'symbol', color: 'muted' },
    'Place labels': { type: 'symbol', color: 'muted' },
    'Village labels': { type: 'symbol', hide: true },
    'Airport labels': { type: 'symbol', color: 'muted' },
    'Longdistance trail labels': { type: 'symbol', color: 'muted' },
    'Bicycle longdistance labels': { type: 'symbol', color: 'muted' },
    'Protected area labels': { type: 'symbol', color: 'muted' },
    'Town labels': { type: 'symbol', color: 'muted' },
    'State labels': { type: 'symbol', color: 'muted' },
    'National park labels': { type: 'symbol', color: 'muted' },
    'City labels': { type: 'symbol', color: 'muted' },
    'Country labels': { type: 'symbol', color: 'muted' },
    'Continent labels': { type: 'symbol', color: 'muted' },
    'Park labels': { type: 'symbol', color: 'muted' },
    // POI labels - hide
    'Outdoor shop': { type: 'symbol', hide: true },
    'Sport': { type: 'symbol', hide: true },
    'Outdoor water': { type: 'symbol', hide: true },
    'Transport': { type: 'symbol', hide: true },
    'Food': { type: 'symbol', hide: true },
    'Healthcare': { type: 'symbol', hide: true },
    'Tourism': { type: 'symbol', hide: true },
    'Culture': { type: 'symbol', hide: true },
    'Outdoor': { type: 'symbol', hide: true },
    'Station': { type: 'symbol', hide: true },
    'Castle': { type: 'symbol', hide: true },
  };

  // Layers to hide entirely (POI, building, village labels)
  var HIDE_LAYERS = [
    'Building',
    'Outdoor shop', 'Sport', 'Outdoor water', 'Transport', 'Food', 'Healthcare',
    'Tourism', 'Culture', 'Outdoor', 'Station', 'Castle',
    'Village labels',
  ];

  // Label layers to recolor and set language
  var LABEL_LAYERS = [
    'River labels', 'Lakeline labels', 'Ocean labels', 'Sea labels', 'Lake labels',
    'Road labels', 'Aerialway labels',
    'Volcano labels (US)', 'Volcano labels', 'Peak labels (US)', 'Peak labels',
    'Place labels', 'Town labels', 'State labels', 'National park labels',
    'City labels', 'Country labels', 'Continent labels',
    'Park labels', 'Longdistance trail labels', 'Bicycle longdistance labels',
    'Protected area labels', 'Airport labels'
  ];

  // Major road layer ids (for glow duplication)
  var MAJOR_ROAD_LAYERS = ['Road network'];

  function applyColor(layer, rule) {
    if (!rule) return;
    if (rule.keep) return; // Keep original styling
    if (rule.hide) {
      layer.layout = layer.layout || {};
      layer.layout.visibility = 'none';
      return;
    }
    var colorKey = rule.color;
    var color = colorKey ? PALETTE[colorKey] : null;
    if (colorKey && !color) return;

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
      if (rule.roadNetwork) {
        // Data-driven color for Road network based on class
        layer.paint['line-color'] = [
          'match', ['get', 'class'],
          'motorway', PALETTE.amber,
          'trunk', PALETTE.amber,
          'primary', PALETTE.amber,
          'secondary', PALETTE.pink,
          'tertiary', PALETTE.pink,
          'minor', PALETTE.violet,
          'service', PALETTE.violet,
          'track', PALETTE.violet,
          PALETTE.muted
        ];
      } else {
        layer.paint['line-color'] = color;
      }
      // line-opacity removed - not supported in this MapLibre GL version
      // if (rule.opacity !== undefined) {
      //   layer.paint['line-opacity'] = rule.opacity;
      // }
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
    if (layer.id === 'Village labels') {
      // Hide village labels entirely
      hideLayer(layer);
    }
    if (layer.id === 'Place labels') {
      // Filter to only show city/town/capital labels, not villages/islands
      layer.filter = ['all', ['in', 'class', 'city', 'town', 'capital'], ['!=', 'capital', 2]];
    }
  }

  function createGlowLayer(layer) {
    if (layer.type !== 'line') return null;
    if (layer.id !== 'Road network') return null;
    var glow = JSON.parse(JSON.stringify(layer));
    glow.id = layer.id + ' (glow)';
    glow.paint = glow.paint || {};
    // Wider - use data-driven expression for width
    if (glow.paint['line-width']) {
      var w = glow.paint['line-width'];
      if (Array.isArray(w)) {
        // Multiply numeric values in the expression by 3
        glow.paint['line-width'] = JSON.parse(JSON.stringify(w).replace(/"(\d+(?:\.\d+)?)"/g, function(m, n) {
          return String(parseFloat(n) * 3);
        }));
      }
    }
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
      if (layer.id === 'Road network' && layer.type === 'line') {
        var glow = createGlowLayer(layer);
        if (glow) newLayers.push(glow);
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
              } else if (style.sources[src].url && style.sources[src].url.indexOf('key={key}') !== -1) {
                style.sources[src].url = style.sources[src].url.replace('key={key}', 'key=' + encodeURIComponent(key));
              }
              if (style.sources[src].tiles) {
                style.sources[src].tiles = style.sources[src].tiles.map(function(t) {
                  return t.indexOf('key=') === -1 ? t + '?key=' + encodeURIComponent(key) : t;
                });
              }
            });
          }
          if (style.glyphs && style.glyphs.indexOf('{key}') !== -1) {
            style.glyphs = style.glyphs.replace('{key}', encodeURIComponent(key));
          } else if (style.glyphs && style.glyphs.indexOf('key=') === -1) {
            style.glyphs += '?key=' + encodeURIComponent(key);
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
