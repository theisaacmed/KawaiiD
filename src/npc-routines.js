// NPC routine system — daily schedules, activity states, deal availability by location
//
// Each Town NPC has a detailed daily routine with specific locations and activities.
// NPCs walk between locations along roads via the pathfinding system.
// Deal availability depends on NPC location and activity.

import { findPath, applySidewalkOffset, buildGraph } from './npc-pathfinding.js';
import { getGameHour, getDayNumber } from './time-system.js';
import { isDistrictUnlocked } from './districts.js';
import { getNamedBuildingPosition } from './named-buildings.js';

// Helper: pull {x, z} from a named building position, fallback to given values
function nb(id, fallbackX, fallbackZ) {
  const pos = getNamedBuildingPosition(id);
  return pos ? { x: pos.x, z: pos.z } : { x: fallbackX, z: fallbackZ };
}

// ========== TOWN NPC SCHEDULES ==========
// time: hour (float), location: {x, z}, activity: string, dealOk: bool
// dealRefuseLine: what NPC says if you try to deal at wrong time/place

// Named building positions — referenced lazily so they're ready at call time
function _meiApt()    { return nb('mei_apartment', 28.8, 15); }
function _lunaTown()  { return nb('luna_townhouse', -7.2, 15); }
function _kitShop()   { return nb('kit_shop', -13.2, 8.4); }
function _fountain()  { return nb('fountain_square', 0, 20); } // now points to town center square
function _naoCafe()   { return nb('nao_cafe', 7.2, 52.8); }
function _marco()     { return nb('marco_restaurant', 30, 54); }
function _harper()    { return nb('harper_office', -21, 54); }
function _tomas()     { return nb('tomas_cottage', 93, -22.8); }
function _playground(){ return nb('playground', 75, 3); }
function _taroFact()  { return nb('taro_factory', -3, -52.8); }
function _vexSquat()  { return nb('vex_squat', 33, -51); }
function _yunaSh()    { return nb('yuna_flower_shop', 93, 81); }
function _kaiShack()  { return nb('kai_shack', 60, 90); }
function _soraB()     { return nb('sora_building', 103.2, 45); }
function _kenjiOff()  { return nb('kenji_office', 100.8, 33); }
function _danteT()    { return nb('dante_tower', -96, 60); }
function _quinnApt()  { return nb('quinn_apartment', -84, 84); }
function _gusOff()    { return nb('gus_dock_office', -33, 118.8); }

// Additional landmark positions (inline fallbacks for non-named-building spots)
function _clockTower()    { return nb('clock_tower', 4.8, 67.2); }
function _chapel()        { return nb('chapel', 78, 81); }
function _theSchool()     { return nb('the_school', 105, -25.2); }
function _marineLH()      { return nb('marina_lighthouse', -57, 135); }
function _shippingYard()  { return nb('shipping_yard', -45, 117); }
function _hotelUptown()   { return nb('the_hotel', 109.2, 34.8); }
function _workshop()      { return nb('workshop_property', 21, -52.8); }

// NPC home/hangout spots without dedicated named buildings
function _renStudio()     { return { x: -3,   z: 60 }; }  // Ren's studio, downtown
function _felixHome()     { return { x: 18,   z: 45  }; }  // Felix's downtown flat
function _dtBench()       { return { x: 6,   z: 45  }; }  // Downtown bench near road
function _mikaHome()      { return { x: 75,  z: -9 }; }  // Mika's burbs house
function _zoeHome()       { return { x: 93,  z: -12 }; }  // Zoe's burbs house
function _saraHome()      { return { x: 81,  z: 3   }; }  // Sara's burbs house
function _jinHome()       { return { x: 87,  z: -31.2 }; }  // Jin's burbs cottage
function _burbsBench()    { return { x: 84,  z: -4.8  }; }  // Benches near burbs park
function _pollyShack()    { return { x: 18,   z: -45 }; }  // Polly's industrial space
function _miraApt()       { return { x: 93,  z: 33  }; }  // Mira's uptown apartment
function _kaiDock()       { return { x: 60,  z: 100.8 }; }  // Kai's dock fishing spot
function _aceHQ()         { return { x: -93, z: -60}; }  // ACE headquarters area
function _townCenter()    { return { x: 0,   z: 20 }; }  // Town center square

const ROUTINES = {
  Mei: [
    { time: 6.0,  ..._meiApt(),  activity: 'sleeping', dealOk: false },
    { time: 7.0,  ..._kitShop(), activity: 'working', dealOk: false, dealRefuseLine: "I'm at work... maybe at lunch?" },
    { time: 12.0, ..._townCenter(), activity: 'standing', dealOk: true },  // town center at lunch
    { time: 13.0, ..._kitShop(), activity: 'working', dealOk: false, dealRefuseLine: "Not at the shop. Find me at lunch." },
    { time: 16.0, ..._townCenter(), activity: 'walking', dealOk: true },  // afternoon stroll through town center
    { time: 17.0, x: -9, z: 57,  activity: 'socializing', dealOk: true, requiresDistrict: 'downtown' }, // Ren's place
    { time: 17.0, ..._meiApt(),   activity: 'walking', dealOk: false, altIfLocked: true }, // go home if downtown locked
    { time: 20.0, ..._meiApt(),   activity: 'sleeping', dealOk: false },
  ],

  Hiro: [
    { time: 6.0,  x: 15,  z: -3,  activity: 'sleeping', dealOk: false },
    { time: 6.5,  x: 30,  z: -6, activity: 'working', dealOk: false, dealRefuseLine: "Not here. Meet me at the alley at noon." },
    { time: 12.0, x: -12, z: 4.8,   activity: 'eating', dealOk: true },   // alley behind market
    { time: 13.0, x: 30,  z: -6, activity: 'working', dealOk: false, dealRefuseLine: "I said not here. Noon at the alley." },
    { time: 15.0, ..._townCenter(), activity: 'wandering', dealOk: true },  // afternoon at town center
    { time: 17.0, ..._marco(),    activity: 'eating', dealOk: true, requiresDistrict: 'downtown' }, // Marco's restaurant
    { time: 17.0, x: 15,  z: -3,  activity: 'walking', dealOk: false, altIfLocked: true },
    { time: 19.0, x: 15,  z: -3,  activity: 'sleeping', dealOk: false },
  ],

  Luna: [
    { time: 7.0,  ..._lunaTown(), activity: 'sleeping', dealOk: false },
    { time: 8.0,  x: -9, z: 21,  activity: 'working', dealOk: true },  // wellness center
    { time: 10.0, ..._townCenter(), activity: 'socializing', dealOk: true }, // town center
    { time: 12.0, ..._naoCafe(),  activity: 'eating', dealOk: true, requiresDistrict: 'downtown' }, // Nao's café
    { time: 12.0, ..._townCenter(), activity: 'socializing', dealOk: true, altIfLocked: true },
    { time: 14.0, ..._townCenter(), activity: 'socializing', dealOk: true }, // back to town center
    { time: 17.0, ..._lunaTown(), activity: 'walking', dealOk: true },
    { time: 18.0, ..._lunaTown(), activity: 'sleeping', dealOk: false },
  ],

  Ash: [
    { time: 8.0,  x: 21,  z: 22.8,  activity: 'sleeping', dealOk: false },
    { time: 9.0,  x: -21, z: 9,  activity: 'working', dealOk: false, dealRefuseLine: "N-not here... too many people..." }, // library
    { time: 12.0, x: -13.2, z: 3,   activity: 'standing', dealOk: true },  // secluded spot
    { time: 13.0, x: -21, z: 9,  activity: 'working', dealOk: false, dealRefuseLine: "I c-can't do this at the library..." },
    { time: 16.0, ..._townCenter(),  activity: 'wandering', dealOk: false, dealRefuseLine: "I'm too nervous out in the open..." },
    { time: 19.0, x: 21,  z: 22.8,  activity: 'sleeping', dealOk: false },
  ],

  // ===== TOWN EXTRAS =====

  Rin: [
    { time: 6.0,  x: -18, z: 18, activity: 'sleeping', dealOk: false },
    { time: 8.0,  x: -6,  z: 15, activity: 'walking', dealOk: true },             // runs out to explore
    { time: 10.0, ..._townCenter(), activity: 'wandering', dealOk: true },          // plays at fountain
    { time: 12.0, x: -12, z: 12, activity: 'walking', dealOk: true },              // exploring west
    { time: 14.0, ..._townCenter(), activity: 'wandering', dealOk: true },          // back at fountain
    { time: 16.0, x: 12,  z: 21, activity: 'walking', dealOk: true },              // east side adventure
    { time: 18.0, x: -18, z: 18, activity: 'walking', dealOk: false, dealRefuseLine: "My mom's calling me home! Tomorrow!" },
    { time: 19.0, x: -18, z: 18, activity: 'sleeping', dealOk: false },
  ],

  Fumio: [
    { time: 7.0,  x: 24,  z: 21, activity: 'sleeping', dealOk: false },
    { time: 9.0,  x: 6,   z: 18, activity: 'walking', dealOk: true },             // morning walk to bench
    { time: 11.0, x: -3,  z: 21, activity: 'sitting', dealOk: true },              // sitting near fountain
    { time: 13.0, ..._townCenter(), activity: 'standing', dealOk: true },           // afternoon at center
    { time: 15.0, x: 12,  z: 18, activity: 'walking', dealOk: true },              // slow walk east
    { time: 17.0, x: 24,  z: 21, activity: 'walking', dealOk: false, dealRefuseLine: "These old legs need rest. Tomorrow." },
    { time: 18.0, x: 24,  z: 21, activity: 'sleeping', dealOk: false },
  ],

  Hana: [
    { time: 7.0,  x: -6,  z: 24, activity: 'sleeping', dealOk: false },
    { time: 9.0,  x: -12, z: 12, activity: 'walking', dealOk: true },             // "grocery shopping"
    { time: 11.0, ..._kitShop(), activity: 'standing', dealOk: true },             // browsing near shop
    { time: 12.0, ..._townCenter(), activity: 'walking', dealOk: true },           // through center
    { time: 14.0, x: -6,  z: 18, activity: 'wandering', dealOk: true },           // afternoon wander
    { time: 16.0, ..._townCenter(), activity: 'socializing', dealOk: true },       // chatting at fountain
    { time: 18.0, x: -6,  z: 24, activity: 'walking', dealOk: false, dealRefuseLine: "Gotta get home before dinner!" },
    { time: 19.0, x: -6,  z: 24, activity: 'sleeping', dealOk: false },
  ],

  // ===== DOWNTOWN =====

  Nao: [
    { time: 6.0,  ..._naoCafe(),    activity: 'working',     dealOk: true,  heldObject: 'coffee',  dealRefuseLine: null },       // opens café, arranges chairs
    { time: 10.0, ..._naoCafe(),    activity: 'working',     dealOk: true,  heldObject: null,       dealRefuseLine: null },       // mid-day café service
    { time: 14.0, ..._townCenter(), activity: 'walking',     dealOk: true },                                                     // afternoon break at town center
    { time: 15.0, ..._naoCafe(),    activity: 'working',     dealOk: true,  heldObject: null,       dealRefuseLine: null },       // back to café
    { time: 17.0, ..._naoCafe(),    activity: 'working',     dealOk: true,  heldObject: 'cloth',    dealRefuseLine: null },       // wiping tables, winding down
    { time: 21.0, ..._naoCafe(),    activity: 'sleeping',    dealOk: false, dealRefuseLine: "Café's closed. Come back tomorrow morning." },
  ],

  Marco: [
    { time: 6.0,  ..._marco(),      activity: 'sleeping',    dealOk: false, dealRefuseLine: "Restaurant's not open yet." },
    { time: 7.0,  ..._marco(),      activity: 'working',     dealOk: false, dealRefuseLine: "I'm setting up for the day. Come back when we open." },
    { time: 10.0, ..._marco(),      activity: 'working',     dealOk: true,  heldObject: 'notepad',  dealRefuseLine: null },       // outside by menu board
    { time: 22.0, ..._marco(),      activity: 'sleeping',    dealOk: false, dealRefuseLine: "Kitchen's closed. Come back tomorrow." },
  ],

  Felix: [
    { time: 0.0,  ..._felixHome(),  activity: 'sleeping',    dealOk: false, dealRefuseLine: "Too late. Come back in the morning." },
    { time: 8.0,  ..._dtBench(),    activity: 'socializing', dealOk: true,  heldObject: 'sketchbook', dealRefuseLine: null },    // morning bench session
    { time: 10.0, ..._townCenter(), activity: 'wandering',   dealOk: true,  heldObject: 'sketchbook' },                          // morning town center sketching
    { time: 12.0, ..._naoCafe(),    activity: 'eating',      dealOk: true,  requiresDistrict: 'downtown' },                       // lunch at Nao's
    { time: 12.0, ..._dtBench(),    activity: 'eating',      dealOk: true,  altIfLocked: true },
    { time: 14.0, ..._clockTower(), activity: 'wandering',   dealOk: true },                                                      // downtown wander
    { time: 18.0, ..._dtBench(),    activity: 'socializing', dealOk: true,  heldObject: 'sketchbook' },                           // evening bench — meets Zoe
    { time: 22.0, ..._felixHome(),  activity: 'sleeping',    dealOk: false, dealRefuseLine: "It's late. Not tonight." },
  ],

  Harper: [
    { time: 0.0,  ..._harper(),     activity: 'sleeping',    dealOk: false, dealRefuseLine: "I'm not doing interviews at this hour." },
    { time: 7.0,  ..._clockTower(), activity: 'walking',     dealOk: true,  heldObject: 'notepad',  dealRefuseLine: null },      // morning neighborhood round
    { time: 10.0, ..._harper(),     activity: 'working',     dealOk: false, dealRefuseLine: "Not at the office. Catch me on my walk at 7AM." },
    { time: 18.0, ..._harper(),     activity: 'working',     dealOk: true,  heldObject: 'notepad',  dealRefuseLine: null },      // after hours more relaxed
    { time: 22.0, ..._harper(),     activity: 'sleeping',    dealOk: false, dealRefuseLine: "Filing deadline. Not now." },
  ],

  Ren: [
    { time: 0.0,  ..._renStudio(),  activity: 'sleeping',    dealOk: false, dealRefuseLine: "Not this late. The art doesn't need you, either." },
    { time: 9.0,  ..._renStudio(),  activity: 'working',     dealOk: true,  heldObject: 'sketchbook' },                           // studio morning
    { time: 12.0, ..._naoCafe(),    activity: 'eating',      dealOk: true,  requiresDistrict: 'downtown' },
    { time: 12.0, ..._renStudio(),  activity: 'sitting',     dealOk: true,  altIfLocked: true },
    { time: 14.0, ..._clockTower(), activity: 'wandering',   dealOk: true,  heldObject: 'sketchbook' },                           // art walk
    { time: 18.0, ..._renStudio(),  activity: 'socializing', dealOk: true },
    { time: 22.0, ..._renStudio(),  activity: 'sleeping',    dealOk: false, dealRefuseLine: "Studio's dark. Come tomorrow." },
  ],

  // ===== BURBS =====

  Mika: [
    { time: 0.0,  ..._mikaHome(),   activity: 'sleeping',    dealOk: false, dealRefuseLine: "I'm asleep!" },
    { time: 8.0,  ..._theSchool(),  activity: 'working',     dealOk: false, dealRefuseLine: "I'm in school right now, meet me after." },
    { time: 14.0, ..._burbsBench(), activity: 'standing',    dealOk: true,  heldObject: 'sketchbook' },                           // after school sketching
    { time: 18.0, ..._mikaHome(),   activity: 'walking',     dealOk: true },
    { time: 20.0, ..._mikaHome(),   activity: 'sleeping',    dealOk: false, dealRefuseLine: "Too tired from class. Tomorrow?" },
  ],

  Zoe: [
    { time: 0.0,  ..._zoeHome(),    activity: 'sleeping',    dealOk: false, dealRefuseLine: "Shh! My parents!" },
    { time: 8.0,  ..._theSchool(),  activity: 'working',     dealOk: false, dealRefuseLine: "I can't do this at school, are you serious?" },
    { time: 15.0, ..._playground(), activity: 'socializing', dealOk: true },                                                      // after school at playground
    { time: 18.0, ..._dtBench(),    activity: 'socializing', dealOk: true,  requiresDistrict: 'downtown' },                       // evening — meets Felix at downtown bench
    { time: 18.0, ..._burbsBench(), activity: 'socializing', dealOk: true,  altIfLocked: true },
    { time: 22.0, ..._zoeHome(),    activity: 'sleeping',    dealOk: false, dealRefuseLine: "I have to be home. Tomorrow?" },
  ],

  Tomas: [
    { time: 0.0,  ..._tomas(),      activity: 'sleeping',    dealOk: false, dealRefuseLine: "I'm already in bed." },
    { time: 8.0,  ..._burbsBench(), activity: 'standing',    dealOk: true,  heldObject: 'book' },                                 // morning reading
    { time: 10.0, ..._playground(), activity: 'walking',     dealOk: true,  heldObject: 'book' },                                 // mid-morning stroll
    { time: 12.0, ..._tomas(),      activity: 'eating',      dealOk: true },                                                      // lunch at cottage
    { time: 14.0, ..._burbsBench(), activity: 'standing',    dealOk: true,  heldObject: 'book' },                                 // afternoon reading
    { time: 17.0, ..._tomas(),      activity: 'walking',     dealOk: true },
    { time: 20.0, ..._tomas(),      activity: 'sleeping',    dealOk: false, dealRefuseLine: "Reading time is over. Good night." },
  ],

  Sara: [
    { time: 0.0,  ..._saraHome(),   activity: 'sleeping',    dealOk: false, dealRefuseLine: "My daughter's asleep. Please." },
    { time: 8.0,  ..._saraHome(),   activity: 'working',     dealOk: false, dealRefuseLine: "Morning routine. Not now, she's watching." },
    { time: 13.0, ..._playground(), activity: 'sitting',     dealOk: true },                                                      // daughter at playground
    { time: 17.0, ..._burbsBench(), activity: 'walking',     dealOk: true },                                                      // evening walk with daughter
    { time: 19.0, ..._saraHome(),   activity: 'working',     dealOk: false, dealRefuseLine: "Bedtime routine. Later." },
    { time: 21.0, ..._saraHome(),   activity: 'sleeping',    dealOk: false, dealRefuseLine: "She just fell asleep. Don't ring the bell." },
  ],

  Jin: [
    { time: 0.0,  ..._jinHome(),    activity: 'sleeping',    dealOk: false, dealRefuseLine: "..." },
    { time: 9.0,  ..._burbsBench(), activity: 'standing',    dealOk: true,  heldObject: 'book' },                                 // morning quiet time
    { time: 12.0, ..._jinHome(),    activity: 'eating',      dealOk: true },
    { time: 14.0, ..._theSchool(),  activity: 'walking',     dealOk: true },                                                      // afternoon stroll around school area
    { time: 17.0, ..._jinHome(),    activity: 'walking',     dealOk: true },
    { time: 20.0, ..._jinHome(),    activity: 'sleeping',    dealOk: false, dealRefuseLine: "That's enough people for one day." },
  ],

  // ===== NORTHTOWN =====

  Yuna: [
    { time: 0.0,  ..._yunaSh(),     activity: 'sleeping',    dealOk: false, dealRefuseLine: "Come by the shop during the day." },
    { time: 6.0,  ..._yunaSh(),     activity: 'working',     dealOk: true,  heldObject: 'flower', dealRefuseLine: null },         // early morning — watering, kneeling in garden
    { time: 10.0, ..._yunaSh(),     activity: 'working',     dealOk: true },
    { time: 18.0, ..._chapel(),     activity: 'walking',     dealOk: true },                                                      // evening walk to chapel
    { time: 20.0, ..._yunaSh(),     activity: 'working',     dealOk: true },
    { time: 22.0, ..._yunaSh(),     activity: 'sleeping',    dealOk: false, dealRefuseLine: "Shop is closed. Come back at dawn." },
  ],

  Kai: [
    { time: 0.0,  ..._kaiShack(),   activity: 'sleeping',    dealOk: false, dealRefuseLine: "Zzz." },
    { time: 6.0,  ..._kaiDock(),    activity: 'sitting',     dealOk: true,  heldObject: 'fishing_rod', dealRefuseLine: null },    // dawn fishing at dock
    { time: 10.0, ..._kaiShack(),   activity: 'working',     dealOk: true },
    { time: 15.0, ..._chapel(),     activity: 'walking',     dealOk: true },                                                      // afternoon stroll
    { time: 18.0, ..._kaiShack(),   activity: 'sitting',     dealOk: true },
    { time: 22.0, ..._kaiShack(),   activity: 'sleeping',    dealOk: false, dealRefuseLine: "Early morning tomorrow. Not tonight." },
  ],

  // ===== INDUSTRIAL =====

  Taro: [
    { time: 0.0,  ..._taroFact(),   activity: 'sleeping',    dealOk: false, dealRefuseLine: "Factory's locked up." },
    { time: 7.0,  ..._taroFact(),   activity: 'working',     dealOk: true,  heldObject: 'toolbox' },                              // at factory
    { time: 12.0, ..._workshop(),   activity: 'eating',      dealOk: true },                                                      // lunch near workshop
    { time: 14.0, ..._taroFact(),   activity: 'working',     dealOk: true },
    { time: 19.0, x: -3, z: -42,   activity: 'walking',     dealOk: false, dealRefuseLine: "Heading home. Not a good time." },
    { time: 21.0, ..._taroFact(),   activity: 'sleeping',    dealOk: false, dealRefuseLine: "Done for the day." },
  ],

  Vex: [
    { time: 0.0,  ..._vexSquat(),   activity: 'working',     dealOk: true,  heldObject: 'spray_can' },                            // night — spray painting
    { time: 6.0,  ..._vexSquat(),   activity: 'sleeping',    dealOk: false, dealRefuseLine: "I just got in. Come back at dusk." },
    { time: 17.0, ..._workshop(),   activity: 'wandering',   dealOk: true,  heldObject: 'spray_can' },                            // late afternoon — out stickering walls
    { time: 22.0, x: 12, z: -49.2,   activity: 'working',     dealOk: true,  heldObject: 'spray_can' },                            // night — spray painting the streets
  ],

  Polly: [
    { time: 0.0,  ..._pollyShack(), activity: 'sleeping',    dealOk: false, dealRefuseLine: "Not this late." },
    { time: 8.0,  ..._pollyShack(), activity: 'working',     dealOk: true },
    { time: 12.0, ..._taroFact(),   activity: 'walking',     dealOk: true },                                                      // lunch walk
    { time: 14.0, ..._pollyShack(), activity: 'working',     dealOk: true },
    { time: 18.0, ..._pollyShack(), activity: 'walking',     dealOk: true },
    { time: 20.0, ..._pollyShack(), activity: 'sleeping',    dealOk: false, dealRefuseLine: "Called it a night. Tomorrow." },
  ],

  // ===== UPTOWN =====

  Sora: [
    { time: 0.0,  ..._soraB(),      activity: 'sleeping',    dealOk: false, dealRefuseLine: "Do you know what time it is?" },
    { time: 9.0,  ..._soraB(),      activity: 'working',     dealOk: true },
    { time: 12.0, ..._hotelUptown(),activity: 'eating',      dealOk: true },                                                      // lunch at hotel restaurant
    { time: 14.0, ..._soraB(),      activity: 'working',     dealOk: true },
    { time: 19.0, ..._kenjiOff(),   activity: 'socializing', dealOk: true },                                                      // evening visit
    { time: 22.0, ..._soraB(),      activity: 'sleeping',    dealOk: false, dealRefuseLine: "Not at this hour. I need my beauty sleep." },
  ],

  Kenji: [
    { time: 0.0,  ..._kenjiOff(),   activity: 'sleeping',    dealOk: false, dealRefuseLine: "This is neither the time nor the place." },
    { time: 7.0,  ..._hotelUptown(),activity: 'walking',     dealOk: true },                                                      // morning walk past hotel
    { time: 9.0,  ..._kenjiOff(),   activity: 'working',     dealOk: false, dealRefuseLine: "Office hours. Absolutely not." },
    { time: 18.0, ..._hotelUptown(),activity: 'walking',     dealOk: true },                                                      // after-hours walk
    { time: 20.0, ..._kenjiOff(),   activity: 'sitting',     dealOk: true },
    { time: 22.0, ..._kenjiOff(),   activity: 'sleeping',    dealOk: false, dealRefuseLine: "I have an early meeting." },
  ],

  Mira: [
    { time: 0.0,  ..._miraApt(),    activity: 'sleeping',    dealOk: false, dealRefuseLine: "Not at night. I value my privacy." },
    { time: 10.0, ..._miraApt(),    activity: 'walking',     dealOk: true },
    { time: 14.0, ..._hotelUptown(),activity: 'socializing', dealOk: true },                                                      // afternoon at hotel bar
    { time: 18.0, ..._soraB(),      activity: 'socializing', dealOk: true },                                                      // evening visit to Sora
    { time: 21.0, ..._miraApt(),    activity: 'sleeping',    dealOk: false, dealRefuseLine: "Done for today." },
  ],

  // ===== TOWER =====

  Dante: [
    { time: 0.0,  ..._danteT(),     activity: 'sleeping',    dealOk: false, dealRefuseLine: "Lobby is closed. Night security's on." },
    { time: 8.0,  ..._danteT(),     activity: 'working',     dealOk: true,  heldObject: 'notepad' },                              // at tower lobby
    { time: 20.0, ..._danteT(),     activity: 'sleeping',    dealOk: false, dealRefuseLine: "End of shift. Come back tomorrow." },
  ],

  Quinn: [
    { time: 0.0,  ..._quinnApt(),   activity: 'wandering',   dealOk: true },                                                     // night — active
    { time: 6.0,  ..._quinnApt(),   activity: 'sleeping',    dealOk: false, dealRefuseLine: "I don't do daylight. Come back after dark." },
    { time: 22.0, ..._quinnApt(),   activity: 'wandering',   dealOk: true },                                                     // late night — reappears
  ],

  // ===== PORT =====

  Gus: [
    { time: 0.0,  ..._gusOff(),     activity: 'sleeping',    dealOk: false, dealRefuseLine: "Docks are closed." },
    { time: 7.0,  ..._shippingYard(),activity: 'working',    dealOk: true,  heldObject: 'notepad' },                             // morning dock rounds
    { time: 12.0, ..._gusOff(),     activity: 'eating',      dealOk: true },                                                     // lunch at office
    { time: 14.0, ..._gusOff(),     activity: 'working',     dealOk: true },
    { time: 18.0, ..._shippingYard(),activity: 'walking',    dealOk: false, dealRefuseLine: "Shift's ending. Tomorrow morning." },
    { time: 20.0, ..._gusOff(),     activity: 'sleeping',    dealOk: false, dealRefuseLine: "Done for the night." },
  ],

  Marina: [
    { time: 0.0,  ..._marineLH(),   activity: 'working',     dealOk: false, dealRefuseLine: "Night is for the light." },
    { time: 10.0, ..._marineLH(),   activity: 'working',     dealOk: true },
    { time: 16.0, ..._shippingYard(),activity: 'walking',    dealOk: true },                                                     // afternoon port walk
    { time: 20.0, ..._marineLH(),   activity: 'working',     dealOk: false, dealRefuseLine: "I'm tending the light." },
  ],

  // ===== ACE HQ (endgame only — Dove) =====

  Dove: [
    { time: 0.0,  ..._aceHQ(),      activity: 'wandering',   dealOk: true },                                                     // night — active near ACE HQ
    { time: 6.0,  ..._aceHQ(),      activity: 'sleeping',    dealOk: false, dealRefuseLine: "Not during the day. You'll get us both caught." },
    { time: 20.0, ..._aceHQ(),      activity: 'wandering',   dealOk: true },                                                     // evening — reappears
  ],

  // ===== SPECIAL — Rina (near spawn, photographer) =====

  Rina: [
    { time: 6.0,  x: 3,   z: 8,   activity: 'sleeping',    dealOk: false },
    { time: 7.0,  x: 3,   z: 8,   activity: 'standing',    dealOk: true },                                                     // morning near spawn — taking photos
    { time: 9.0,  ..._fountain(),  activity: 'walking',     dealOk: true },                                                     // walks to fountain for morning light
    { time: 12.0, ..._townCenter(),activity: 'socializing',  dealOk: true },                                                     // lunch at town center — people watching
    { time: 14.0, x: 15,  z: 18,  activity: 'walking',      dealOk: true },                                                     // afternoon — photographing east side
    { time: 16.0, x: -6,  z: 24,  activity: 'standing',     dealOk: true },                                                     // golden hour — taking sunset photos
    { time: 18.0, x: 3,   z: 8,   activity: 'walking',      dealOk: false },                                                    // heading home
    { time: 20.0, x: 3,   z: 8,   activity: 'sleeping',     dealOk: false },
  ],

  // Dex is special — random daily location
  Dex: null, // handled by getDexRoutine()
};

// Dex picks a random location each day
const DEX_SPOTS = [
  { x: -18, z: 21, hint: "Behind the tall building on the west side today." },
  { x: 22.8,  z: -4.8, hint: "East road, near the edge. Don't be late." },
  { x: -12, z: -3, hint: "South of the fountain. You know the spot." },
  { x: 15,  z: 24, hint: "North end of town. Back alley." },
  { x: -24, z: 12, hint: "West street. I'll be in the shadows." },
];

// Cache Dex's daily spot
let dexDay = -1;
let dexSpot = null;

function getDexSpotForDay(dayNumber) {
  if (dexDay === dayNumber) return dexSpot;
  dexDay = dayNumber;
  // Deterministic random based on day number
  const idx = dayNumber % DEX_SPOTS.length;
  dexSpot = DEX_SPOTS[idx];
  return dexSpot;
}

export function getDexRoutine(dayNumber) {
  const spot = getDexSpotForDay(dayNumber);
  return [
    { time: 0,    x: 18,      z: 6,     activity: 'sleeping', dealOk: false },
    { time: 10.0, x: spot.x,  z: spot.z, activity: 'working', dealOk: true },
    { time: 16.0, x: 18,      z: 6,     activity: 'sleeping', dealOk: false },
  ];
}

export function getDexDailyMessage(dayNumber) {
  const spot = getDexSpotForDay(dayNumber);
  return spot.hint;
}

// ========== ROUTINE STATE PER NPC ==========

// Runtime state: { currentEntryIndex, path, pathIndex, pauseTimer, activity }
const routineStates = {};

export function getRoutineState(npcName) {
  if (!routineStates[npcName]) {
    routineStates[npcName] = {
      currentEntryIndex: 0,
      path: null,          // array of { x, z } waypoints
      pathIndex: 0,        // current waypoint index
      pauseTimer: 0,       // random pause countdown
      nextPauseIn: randomBetween(8, 20), // seconds until next random pause
      activity: 'sleeping',
      atDestination: false,
      wanderTarget: null,  // for 'wandering' activity
      wanderTimer: 0,
      dealFrozen: false,   // true when player initiated a deal (NPC stops walking)
    };
  }
  return routineStates[npcName];
}

// ========== SCHEDULE RESOLUTION ==========

/**
 * Get the current schedule entry for an NPC at the given hour.
 * Handles the alt-if-locked logic for downtown-dependent entries.
 */
export function getCurrentScheduleEntry(npcName, hour) {
  let schedule;
  if (npcName === 'Dex') {
    schedule = getDexRoutine(getDayNumber());
  } else {
    schedule = ROUTINES[npcName];
  }
  if (!schedule) return null;

  // Find the latest entry whose time <= hour
  let best = null;
  let skipAlt = false;

  for (let i = schedule.length - 1; i >= 0; i--) {
    const entry = schedule[i];
    if (entry.time > hour) continue;

    // If this entry requires a district and it's locked, skip to altIfLocked
    if (entry.requiresDistrict && !isDistrictUnlocked(entry.requiresDistrict)) {
      continue;
    }

    // If this is an alt entry and we already found the primary, skip
    if (entry.altIfLocked && !skipAlt) {
      // This is the fallback — use it only if we haven't found a primary
      if (!best) {
        best = entry;
      }
      continue;
    }

    best = entry;
    break;
  }

  return best || schedule[0];
}

/**
 * Check if a schedule transition happened (NPC needs to start walking to new location).
 * Returns the new entry if a transition occurred, null otherwise.
 */
export function checkScheduleTransition(npcName, hour, currentEntryIndex) {
  let schedule;
  if (npcName === 'Dex') {
    schedule = getDexRoutine(getDayNumber());
  } else {
    schedule = ROUTINES[npcName];
  }
  if (!schedule) return null;

  // Build filtered schedule (respecting district locks)
  const filtered = [];
  const seen = new Set();
  for (const entry of schedule) {
    if (entry.requiresDistrict && !isDistrictUnlocked(entry.requiresDistrict)) continue;
    if (entry.altIfLocked) {
      // Only use alt if the primary at same time was skipped
      const primaryAtSameTime = schedule.find(e =>
        e.time === entry.time && e !== entry && !e.altIfLocked
      );
      if (primaryAtSameTime && (!primaryAtSameTime.requiresDistrict || isDistrictUnlocked(primaryAtSameTime.requiresDistrict))) {
        continue; // Primary is available, skip alt
      }
    }
    // Dedupe by time
    if (!seen.has(entry.time)) {
      filtered.push(entry);
      seen.add(entry.time);
    }
  }

  // Find the entry index for current hour
  let targetIndex = 0;
  for (let i = filtered.length - 1; i >= 0; i--) {
    if (hour >= filtered[i].time) {
      targetIndex = i;
      break;
    }
  }

  if (targetIndex !== currentEntryIndex && targetIndex < filtered.length) {
    return { entry: filtered[targetIndex], index: targetIndex };
  }
  return null;
}

// ========== PATH MANAGEMENT ==========

/**
 * Calculate a new path for an NPC from their current position to a destination.
 */
export function calculateRoutePath(fromX, fromZ, toX, toZ) {
  buildGraph();
  const rawPath = findPath(fromX, fromZ, toX, toZ);
  return applySidewalkOffset(rawPath);
}

// ========== ACTIVITY STATE BEHAVIORS ==========

/**
 * Get the Y-position offset for an activity (e.g., sitting lowers the NPC).
 */
export function getActivityYOffset(activity) {
  if (activity === 'sitting') return -0.5;
  return 0;
}

/**
 * Generate a random nearby wander point for the 'wandering' activity.
 */
export function getWanderTarget(centerX, centerZ) {
  const angle = Math.random() * Math.PI * 2;
  const dist = 5 + Math.random() * 15;
  return {
    x: centerX + Math.cos(angle) * dist,
    z: centerZ + Math.sin(angle) * dist,
  };
}

// ========== DEAL AVAILABILITY ==========

/**
 * Check if an NPC is willing to deal at their current location/activity.
 * Returns { canDeal: bool, refuseLine: string|null }
 */
export function checkDealAvailability(npcName, hour) {
  const entry = getCurrentScheduleEntry(npcName, hour);
  if (!entry) return { canDeal: true, refuseLine: null };

  if (entry.dealOk) {
    return { canDeal: true, refuseLine: null };
  }

  return {
    canDeal: false,
    refuseLine: entry.dealRefuseLine || "Not right now.",
  };
}

/**
 * Check if this NPC has a routine defined (Town NPCs only for now).
 */
export function hasRoutine(npcName) {
  return npcName === 'Dex' || ROUTINES[npcName] != null;
}

// ========== DEAL FREEZE ==========

/**
 * Freeze an NPC's movement (player initiated a deal).
 */
export function freezeForDeal(npcName) {
  const state = getRoutineState(npcName);
  state.dealFrozen = true;
}

/**
 * Unfreeze an NPC's movement (deal ended).
 */
export function unfreezeFromDeal(npcName) {
  const state = getRoutineState(npcName);
  state.dealFrozen = false;
}

// ========== SAVE / RESTORE ==========

export function getRoutineSaveData() {
  const data = {};
  for (const [name, state] of Object.entries(routineStates)) {
    data[name] = {
      currentEntryIndex: state.currentEntryIndex,
      activity: state.activity,
      atDestination: state.atDestination,
    };
  }
  return data;
}

export function restoreRoutineState(data) {
  if (!data) return;
  for (const [name, saved] of Object.entries(data)) {
    const state = getRoutineState(name);
    state.currentEntryIndex = saved.currentEntryIndex || 0;
    state.activity = saved.activity || 'sleeping';
    state.atDestination = saved.atDestination || false;
    // Path will be recalculated on next update
    state.path = null;
    state.pathIndex = 0;
  }
}

/**
 * Reset all routine states for a new day.
 */
export function resetRoutinesForNewDay() {
  for (const state of Object.values(routineStates)) {
    state.currentEntryIndex = 0;
    state.path = null;
    state.pathIndex = 0;
    state.activity = 'sleeping';
    state.atDestination = false;
    state.pauseTimer = 0;
    state.wanderTarget = null;
    state.dealFrozen = false;
  }
}

// ========== HELPERS ==========

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}
