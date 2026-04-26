export const MACHINES = {
  'creality-falcon5w': {
    name: 'Falcon 5W',
    brand: 'Creality',
    power: 5,
    area: { w: 400, h: 415 },
    maxSpeed: 10000,
    engrave: { speedFactor: 1.00, powerFactor: 1.00 },
    cut:     { speedFactor: 1.00, powerFactor: 1.00, passFactor: 1.00 },
  },
  'creality-falcon2-22w': {
    name: 'Falcon2 22W',
    brand: 'Creality',
    power: 22,
    area: { w: 400, h: 415 },
    maxSpeed: 25000,
    engrave: { speedFactor: 2.80, powerFactor: 0.40 },
    cut:     { speedFactor: 2.20, powerFactor: 0.50, passFactor: 0.50 },
  },
  'sculpfun-s9': {
    name: 'S9',
    brand: 'Sculpfun',
    power: 5.5,
    area: { w: 410, h: 420 },
    maxSpeed: 10000,
    engrave: { speedFactor: 1.05, powerFactor: 0.97 },
    cut:     { speedFactor: 1.05, powerFactor: 0.97, passFactor: 1.00 },
  },
  'sculpfun-s10': {
    name: 'S10',
    brand: 'Sculpfun',
    power: 10,
    area: { w: 410, h: 420 },
    maxSpeed: 18000,
    engrave: { speedFactor: 1.60, powerFactor: 0.65 },
    cut:     { speedFactor: 1.40, powerFactor: 0.70, passFactor: 0.75 },
  },
  'sculpfun-s30-pro': {
    name: 'S30 Pro Max',
    brand: 'Sculpfun',
    power: 20,
    area: { w: 600, h: 600 },
    maxSpeed: 20000,
    engrave: { speedFactor: 2.60, powerFactor: 0.42 },
    cut:     { speedFactor: 2.00, powerFactor: 0.52, passFactor: 0.50 },
  },
  'xtool-d1-pro-20w': {
    name: 'D1 Pro 20W',
    brand: 'xTool',
    power: 20,
    area: { w: 430, h: 390 },
    maxSpeed: 24000,
    engrave: { speedFactor: 2.70, powerFactor: 0.42 },
    cut:     { speedFactor: 2.10, powerFactor: 0.52, passFactor: 0.50 },
  },
  'xtool-s1-40w': {
    name: 'S1 40W',
    brand: 'xTool',
    power: 40,
    area: { w: 498, h: 319 },
    maxSpeed: 36000,
    engrave: { speedFactor: 4.50, powerFactor: 0.28 },
    cut:     { speedFactor: 3.50, powerFactor: 0.35, passFactor: 0.35 },
  },
  'atomstack-a20-pro': {
    name: 'A20 Pro',
    brand: 'Atomstack',
    power: 20,
    area: { w: 400, h: 400 },
    maxSpeed: 15000,
    engrave: { speedFactor: 2.60, powerFactor: 0.42 },
    cut:     { speedFactor: 2.00, powerFactor: 0.52, passFactor: 0.50 },
  },
  'atomstack-x20-pro': {
    name: 'X20 Pro',
    brand: 'Atomstack',
    power: 20,
    area: { w: 800, h: 800 },
    maxSpeed: 15000,
    engrave: { speedFactor: 2.60, powerFactor: 0.42 },
    cut:     { speedFactor: 2.00, powerFactor: 0.52, passFactor: 0.50 },
  },
  'ortur-lm3': {
    name: 'LM3',
    brand: 'Ortur',
    power: 10,
    area: { w: 400, h: 400 },
    maxSpeed: 20000,
    engrave: { speedFactor: 1.60, powerFactor: 0.65 },
    cut:     { speedFactor: 1.40, powerFactor: 0.70, passFactor: 0.75 },
  },
}

export function applyMachine(params, machineKey, mode) {
  if (!params) return null
  const machine = MACHINES[machineKey]
  if (!machine) return params

  const isEngrave = mode === 'engrave' || mode === 'vector'
  const f = isEngrave ? machine.engrave : machine.cut

  return {
    ...params,
    speed:  Math.round(params.speed  * f.speedFactor / 10) * 10,
    power:  Math.min(100, Math.round(params.power  * f.powerFactor)),
    passes: isEngrave
      ? params.passes
      : Math.max(1, Math.ceil(params.passes * f.passFactor)),
  }
}
