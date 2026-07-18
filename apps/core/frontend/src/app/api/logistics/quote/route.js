/**
 * DUNAZOE Logistics Quote API
 * POST /api/logistics/quote
 * 
 * Returns real-time shipping options ranked by AI scoring (cost 40%, reliability 35%, speed 25%).
 * Works standalone — no microservice dependency. When dunazoe-express (port 4032) is online,
 * it proxies there for DB-backed performance data.
 *
 * Priority order: Self-Delivery → DUNAZOE Express Local → Shipbubble → GIG → DHL → FedEx/UPS
 */
import { NextResponse } from "next/server";

// ── Nigeria: all 36 states + FCT + major LGAs/cities ──────────────────────────
const NG_ZONES = {
  lagos:    ["lagos","ikeja","lekki","surulere","yaba","victoria island","ajah","festac","oshodi","mushin","alimosho","agege","kosofe","shomolu","epe","badagry","ikorodu","ojo","apapa","isale-eko"],
  oyo:      ["ibadan","ogbomoso","oyo","iseyin","saki","eruwa","fiditi","igbo-ora","igboho","kishi","komu","lalupon","lanlate","meko","okeho","oranyan","saki"],
  lagos_oyo:["lagos","ibadan","ikeja","lekki","surulere"], // same-zone for cheap express
  ogun:     ["abeokuta","sagamu","ijebu-ode","ijebu-igbo","ota","ilaro","shagamu","ewekoro","imeko","mowe","ofada","sango-ota"],
  osun:     ["osogbo","ile-ife","ilesa","ede","iwo","ikirun","ila-orangun","modakeke","ikire","ejigbo","iree","erin-osun"],
  ondo:     ["akure","owo","ore","okitipupa","ondo","ifon","idanre","ode-ondo","ilaje","odigbo","ese-odo"],
  ekiti:    ["ado-ekiti","ikere-ekiti","ijero-ekiti","ilawe-ekiti","ipoti-ekiti","efon-alaaye","emure-ekiti"],
  kwara:    ["ilorin","offa","omu-aran","kaiama","lafiagi","share","ajase-ipo","erin-ile","jebba","pategi"],
  kogi:     ["lokoja","okene","kabba","idah","ankpa","dekina","ofu","ibaji","ajaokuta"],
  benue:    ["makurdi","gboko","otukpo","katsina-ala","vandeikya","ushongo","logo","tarka","gwer"],
  edo:      ["benin city","auchi","ekpoma","uromi","ubiaja","igarra","owan","etsako","sabongida-ora"],
  delta:    ["asaba","warri","sapele","agbor","abraka","ughelli","ozoro","kwale","oleh","isoko"],
  rivers:   ["port harcourt","ph","bonny","degema","eleme","etche","ikwerre","obio-akpor","okrika","opobo"],
  anambra:  ["awka","onitsha","nnewi","ekwulobia","aguata","dunukofia","idemili","ogbaru","orumba"],
  enugu:    ["enugu","nsukka","agbani","oji-river","udi","nkanu","igbo-eze","igbo-etiti"],
  imo:      ["owerri","orlu","okigwe","mbaise","oguta","ihiala","ngor-okpala","ideato","onuimo"],
  abia:     ["umuahia","aba","ohafia","bende","isuikwuato","ikwuano","obingwa","osisioma"],
  cross_river:["calabar","ugep","ikom","ogoja","obudu","obubra","abi","biase","bekwarra"],
  akwa_ibom:["uyo","eket","ikot-ekpene","abak","oron","etinan","ini","nsit","ibiono"],
  ebonyi:   ["abakaliki","afikpo","onueke","ezza","ikwo","ishielu","ohaozara","onicha"],
  bayelsa:  ["yenagoa","brass","nembe","ogbia","sagbama","kolokuma","ekeremor","southern-ijaw"],
  kano:     ["kano","wudil","bichi","gwarzo","rano","sumaila","ungogo","dala","fagge","gwale"],
  kaduna:   ["kaduna","zaria","kafanchan","soba","birnin-gwari","chikun","giwa","igabi","kachia"],
  katsina:  ["katsina","daura","funtua","dutsin-ma","mashi","jibia","batagarawa","bakori","danja"],
  sokoto:   ["sokoto","wurno","binji","bodinga","dange-shuni","gada","gudu","gwadabawa","illela"],
  zamfara:  ["gusau","kaura-namoda","talata-mafara","anka","bakura","birnin-magaji","bungudu"],
  kebbi:    ["birnin-kebbi","argungu","kamba","jega","aliero","bunza","dandi","fakai","gwandu"],
  niger:    ["minna","bida","suleja","kontagora","lapai","mariga","mashegu","mokwa","rafi"],
  fct:      ["abuja","gwagwalada","kuje","bwari","kwali","abaji","garki","wuse","maitama","gwarinpa"],
  plateau:  ["jos","barkin ladi","bassa","bokkos","jos-east","jos-north","jos-south","kanke","langtang"],
  nasarawa: ["lafia","akwanga","doma","keffi","kokona","nasarawa","obi","toto","wamba"],
  taraba:   ["jalingo","bali","donga","gashaka","gassol","ibi","karim-lamido","kurmi","lau"],
  borno:    ["maiduguri","bama","biu","chibok","damboa","dikwa","gwoza","kala/balge","kukawa"],
  yobe:     ["damaturu","bade","bursari","fika","geidam","gujba","gulani","jakusko","karasuwa"],
  gombe:    ["gombe","akko","balanga","billiri","dukku","funakaye","kaltungo","nafada","shomgom"],
  bauchi:   ["bauchi","alkaleri","bogoro","damban","darazo","gamawa","ganjuwa","itas/gadau"],
  adamawa:  ["yola","demsa","fufore","ganye","girei","gombi","guyuk","hong","jada","lamurde"],
  jigawa:   ["dutse","auyo","babura","biriniwa","buji","gagarawa","garki","gumel","guri","hadejia"],
};

// Flat lookup: city → zone key
const CITY_ZONE = {};
for (const [zone, cities] of Object.entries(NG_ZONES)) {
  for (const city of cities) CITY_ZONE[city.toLowerCase()] = zone;
}

// Zones that count as "same zone" (reduced shipping cost)
const SAME_ZONE_CLUSTERS = [
  ["lagos","ogun","oyo","osun","ondo","ekiti"],        // SW cluster
  ["rivers","bayelsa","delta","edo","cross_river","akwa_ibom"], // SS cluster
  ["anambra","enugu","imo","abia","ebonyi"],             // SE cluster
  ["kano","kaduna","katsina","zamfara","sokoto","kebbi","jigawa"], // NW cluster
  ["fct","niger","kwara","kogi","benue","plateau","nasarawa"],    // NC cluster
  ["borno","yobe","adamawa","gombe","taraba","bauchi"],  // NE cluster
];

// International zones
const INTL_ZONES = {
  "west_africa": ["ghana","benin","togo","ivory coast","cote d'ivoire","cameroon","senegal","guinea","mali","niger republic","burkina faso"],
  "east_africa": ["kenya","ethiopia","tanzania","uganda","rwanda","somalia","sudan"],
  "uk":          ["united kingdom","uk","england","scotland","wales","northern ireland","london"],
  "usa":         ["united states","usa","us","america"],
  "canada":      ["canada"],
  "europe":      ["france","germany","spain","italy","netherlands","portugal","belgium","sweden"],
  "china":       ["china","hong kong","taiwan"],
  "uae":         ["uae","dubai","united arab emirates","abu dhabi"],
  "asia":        ["india","pakistan","malaysia","singapore","indonesia","philippines","japan"],
};

function detectZone(city = "", state = "") {
  const c = (city + "").toLowerCase().trim();
  const s = (state + "").toLowerCase().trim();
  return CITY_ZONE[c] || CITY_ZONE[s] || state.toLowerCase().replace(/\s+/g,"-") || "unknown";
}

function isSameZone(zone1, zone2) {
  if (zone1 === zone2) return true;
  for (const cluster of SAME_ZONE_CLUSTERS) {
    if (cluster.includes(zone1) && cluster.includes(zone2)) return true;
  }
  return false;
}

function detectIntl(destination = "") {
  const d = destination.toLowerCase();
  for (const [region, countries] of Object.entries(INTL_ZONES)) {
    if (countries.some(c => d.includes(c))) return region;
  }
  return null;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lat2) return null;
  const R  = 6371;
  const dL = Math.PI / 180 * (lat2 - lat1);
  const dN = Math.PI / 180 * (lon2 - lon1);
  const a  = Math.sin(dL/2)**2 + Math.cos(Math.PI/180*lat1)*Math.cos(Math.PI/180*lat2)*Math.sin(dN/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Courier rate tables ────────────────────────────────────────────────────────
const COURIER_BASE = {
  shipbubble:    { ng_same: 1000, ng_diff: 2000, waf: 8000,  uk: 25000, us: 35000, intl: 18000 },
  gig:           { ng_same: 1200, ng_diff: 2500, waf: 10000, uk: 30000, us: 40000, intl: 22000 },
  jumia_express: { ng_same: 1500, ng_diff: 3000, waf: null,  uk: null,  us: null,  intl: null  },
  dhl:           { ng_same: 3500, ng_diff: 5000, waf: 15000, uk: 35000, us: 45000, intl: 28000 },
  fedex:         { ng_same: 4000, ng_diff: 6000, waf: 18000, uk: 40000, us: 50000, intl: 32000 },
  ups:           { ng_same: 4200, ng_diff: 6500, waf: 19000, uk: 42000, us: 52000, intl: 34000 },
};

const COURIER_ETA = { // days
  shipbubble:    { ng_same: 1, ng_diff: 2, waf: 5,  uk: 7,  us: 10, intl: 7  },
  gig:           { ng_same: 1, ng_diff: 3, waf: 7,  uk: 10, us: 14, intl: 10 },
  jumia_express: { ng_same: 1, ng_diff: 3, waf: 99, uk: 99, us: 99, intl: 99 },
  dhl:           { ng_same: 1, ng_diff: 2, waf: 3,  uk: 3,  us: 4,  intl: 3  },
  fedex:         { ng_same: 1, ng_diff: 2, waf: 3,  uk: 3,  us: 4,  intl: 3  },
  ups:           { ng_same: 1, ng_diff: 2, waf: 4,  uk: 4,  us: 5,  intl: 4  },
};

// Historical reliability (seeded — improves as real data flows in from dunazoe-express)
const COURIER_RELIABILITY = {
  shipbubble: 0.91, gig: 0.87, jumia_express: 0.78,
  dhl: 0.95, fedex: 0.94, ups: 0.93,
};

function buildQuotes({ originZone, destZone, isIntl, intlRegion, distanceKm, orderAmount, selfDelivery }) {
  const zoneKey = isIntl ? (intlRegion || "intl") : (isSameZone(originZone, destZone) ? "ng_same" : "ng_diff");
  const quotes  = [];

  // Self-delivery option (cheapest — vendor delivers personally)
  if (selfDelivery?.available) {
    quotes.push({
      id:          "self_delivery",
      name:        "Vendor Self-Delivery",
      icon:        "🛵",
      description: selfDelivery.description || "Vendor delivers directly — lowest cost",
      eta_label:   selfDelivery.eta || "Same day – 2 days",
      cost_ngn:    selfDelivery.cost_ngn || 0,
      is_free:     (selfDelivery.cost_ngn || 0) === 0,
      badge:       "CHEAPEST",
      badge_color: "#10B981",
      type:        "self_delivery",
      score:       1.0,
    });
  }

  // DUNAZOE Express local option (no courier API key needed — internal network)
  if (!isIntl && zoneKey === "ng_same") {
    const localCost = Math.round(500 + (distanceKm || 20) * 50);
    quotes.push({
      id:          "dunazoe_express",
      name:        "DUNAZOE Express",
      icon:        "⚡",
      description: "DUNAZOE verified delivery agent — fastest local option",
      eta_label:   "Same day – Next day",
      cost_ngn:    localCost,
      is_free:     false,
      badge:       "FASTEST",
      badge_color: "#FF6B00",
      type:        "dunazoe_express",
      score:       0.92,
    });
  }

  // Courier options
  for (const [courier, rates] of Object.entries(COURIER_BASE)) {
    const base = rates[zoneKey];
    if (!base) continue; // courier doesn't serve this zone

    const distMul  = distanceKm && distanceKm > 200 ? 1 + (distanceKm - 200) * 0.003 : 1;
    const cost_ngn = Math.round(base * distMul);
    const eta_days = COURIER_ETA[courier]?.[zoneKey] || 5;
    const rely     = COURIER_RELIABILITY[courier] || 0.80;

    // AI score: cost (40%) + reliability (35%) + speed (25%)
    const costScore  = 1 - Math.min(cost_ngn / 60000, 1);
    const speedScore = 1 - Math.min(eta_days / 14, 1);
    const score      = costScore * 0.40 + rely * 0.35 + speedScore * 0.25;

    const name = {
      shipbubble: "Shipbubble", gig: "GIG Logistics",
      jumia_express: "Jumia Express", dhl: "DHL Express",
      fedex: "FedEx", ups: "UPS",
    }[courier] || courier;

    quotes.push({
      id:          courier,
      name,
      icon:        { shipbubble:"🚀", gig:"🚛", jumia_express:"🟠", dhl:"🟡", fedex:"🟣", ups:"🟤" }[courier] || "📦",
      description: isIntl
        ? `International shipping via ${name}`
        : `${name} — ${isSameZone(originZone, destZone) ? "same region" : "inter-state"} delivery`,
      eta_label:   eta_days === 1 ? "Next day" : `${eta_days}–${eta_days+1} days`,
      cost_ngn,
      is_free:     false,
      badge:       null,
      badge_color: null,
      type:        "courier",
      courier_id:  courier,
      score,
    });
  }

  // Sort by score descending; badge the best non-self courier
  quotes.sort((a, b) => {
    if (a.type === "self_delivery") return -1;
    if (b.type === "self_delivery") return 1;
    return b.score - a.score;
  });

  // Mark best value among couriers
  const bestCourier = quotes.find(q => q.type === "courier" || q.type === "dunazoe_express");
  if (bestCourier && !bestCourier.badge) {
    bestCourier.badge       = "AI PICK";
    bestCourier.badge_color = "#6D28D9";
  }

  return quotes;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      origin_city = "", origin_state = "",
      dest_city   = "", dest_state   = "",
      dest_country= "nigeria",
      origin_lat, origin_lng, dest_lat, dest_lng,
      order_amount = 0,
      self_delivery,       // { available, cost_ngn, eta, description, zones }
    } = body;

    // Detect international
    const isIntl    = !["nigeria","ng","","null","undefined"].includes((dest_country||"").toLowerCase().trim());
    const intlRegion= isIntl ? detectIntl(dest_country) : null;

    // Zone detection
    const originZone = detectZone(origin_city, origin_state);
    const destZone   = detectZone(dest_city, dest_state);
    const distanceKm = haversineKm(origin_lat, origin_lng, dest_lat, dest_lng);

    // Check if self-delivery vendor covers this zone
    let selfDeliveryOption = null;
    if (self_delivery?.available) {
      const zones = (self_delivery.zones || []).map(z => z.toLowerCase());
      const destMatch = zones.length === 0
        || zones.includes("all")
        || zones.includes("everywhere")
        || zones.some(z =>
            dest_city.toLowerCase().includes(z) ||
            dest_state.toLowerCase().includes(z) ||
            z.includes(dest_city.toLowerCase()) ||
            z.includes(dest_state.toLowerCase())
          );
      if (destMatch) {
        selfDeliveryOption = { ...self_delivery, available: true };
      }
    }

    // Try to forward to live dunazoe-express if running
    let liveQuotes = null;
    try {
      const expressUrl = `${process.env.DUNAZOE_EXPRESS_URL || "http://localhost:4032"}/express/quote`;
      const r = await fetch(expressUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ origin_city, origin_state, dest_city, dest_state, dest_country, order_amount, origin_lat, origin_lng, dest_lat, dest_lng }),
        signal: AbortSignal.timeout(2000), // 2s timeout — don't block checkout
      });
      if (r.ok) {
        const data = await r.json();
        if (data.quotes?.length) liveQuotes = data.quotes;
      }
    } catch (_) { /* service offline — use inline AI */ }

    const quotes = liveQuotes || buildQuotes({
      originZone, destZone, isIntl, intlRegion,
      distanceKm, orderAmount: order_amount,
      selfDelivery: selfDeliveryOption,
    });

    return NextResponse.json({
      success: true,
      quotes,
      origin_zone: originZone,
      dest_zone:   destZone,
      is_international: isIntl,
      intl_region: intlRegion,
      distance_km: distanceKm ? parseFloat(distanceKm.toFixed(1)) : null,
      ai_note: liveQuotes
        ? "Live quotes from DUNAZOE Express network"
        : "AI-estimated quotes — final cost confirmed at dispatch",
    });

  } catch (err) {
    console.error("[LogisticsQuote]", err?.message);
    return NextResponse.json({ success: false, error: err?.message }, { status: 500 });
  }
}
