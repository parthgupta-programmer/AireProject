import { Car, CloudFog, Construction, Factory, Flame, Sparkles, type LucideIcon } from 'lucide-react'
import type { PollutantKey } from '@/types/airQuality'

/** What a breath of clean, dry air is made of (approximate, by volume). */
export const CLEAN_AIR = [
  { label: 'Nitrogen', share: 78, bar: 'bg-primary' },
  { label: 'Oxygen', share: 21, bar: 'bg-aqi-good' },
  { label: 'Argon and trace gases', share: 1, bar: 'bg-aqi-moderate' },
]

export interface PollutantLesson {
  name: string
  what: string
  from: string
  body: string
  tip: string
}

export const POLLUTANT_LESSONS: Record<PollutantKey, PollutantLesson> = {
  pm25: {
    name: 'Fine particles (under 2.5 micrometres)',
    what: 'Microscopic specks of soot, smoke and chemicals, roughly 30 times thinner than a human hair. Too small to see individually.',
    from: 'Vehicle exhaust, burning of crop residue, wood, coal and waste, industry, and gases that turn into particles in the air.',
    body: 'Goes deep into the lungs and can pass into the bloodstream. Linked to asthma attacks, heart disease, stroke and, over years, lung cancer.',
    tip: 'A well-fitted N95 / FFP2 mask outdoors and a HEPA purifier indoors are the most effective protection.',
  },
  pm10: {
    name: 'Coarse dust (under 10 micrometres)',
    what: 'Larger particles of dust, soil and ash. Some are visible as haze.',
    from: 'Road and construction dust, bare soil, dust storms, industry and burning.',
    body: 'Mostly trapped in the nose and throat. Causes coughing, irritation and makes asthma worse.',
    tip: 'Stay away from construction sites and dusty roads; a damp cloth over a mouth and nose is not enough, use a proper mask.',
  },
  no2: {
    name: 'Nitrogen dioxide',
    what: 'A reddish-brown gas with a sharp smell, formed whenever fuel burns at high temperature.',
    from: 'Mainly vehicles (especially diesel), plus power plants and industry.',
    body: 'Inflames the airways, makes lung infections more likely and can trigger asthma, particularly in children.',
    tip: 'Avoid walking or cycling along heavy traffic at rush hour; side streets and parks usually have less.',
  },
  so2: {
    name: 'Sulphur dioxide',
    what: 'A colourless gas with a harsh smell, released when sulphur-containing fuel is burned.',
    from: 'Coal-fired power plants, refineries, metal smelters and some industrial boilers.',
    body: 'Irritates the eyes, nose and throat, can cause wheezing, and helps form fine particles in the air.',
    tip: 'People living near industrial areas should watch readings closely, especially if they have asthma.',
  },
  co: {
    name: 'Carbon monoxide',
    what: 'An invisible, odourless gas made when fuel burns without enough oxygen.',
    from: 'Vehicles, cooking fires, coal or wood stoves, generators and burning waste.',
    body: 'Stops the blood carrying oxygen properly. Causes headaches and dizziness, and can be deadly in closed spaces.',
    tip: 'Never run a generator, coal stove or engine in a closed room or garage, and keep cooking areas ventilated.',
  },
  o3: {
    name: 'Ground-level ozone',
    what: 'Not released directly. It forms when vehicle and industrial gases react in strong sunlight, so it builds up on hot, still afternoons.',
    from: 'Chemical reactions between nitrogen oxides and other vapours (from fuel, paint and solvents) under sunlight.',
    body: 'Causes coughing, chest tightness and sore throat, and can reduce lung function, even in healthy people.',
    tip: 'Exercise outdoors in the early morning rather than the afternoon when ozone peaks.',
  },
}

export interface PollutionSource {
  icon: LucideIcon
  title: string
  text: string
  makes: string
}

export const SOURCES: PollutionSource[] = [
  {
    icon: Car,
    title: 'Vehicles',
    text: 'Petrol and diesel engines, old and poorly maintained vehicles, and traffic jams.',
    makes: 'NO₂, CO, PM2.5, ozone (indirectly)',
  },
  {
    icon: Factory,
    title: 'Industry and power plants',
    text: 'Coal-fired power stations, brick kilns, factories and refineries.',
    makes: 'SO₂, PM2.5, NO₂',
  },
  {
    icon: Flame,
    title: 'Burning',
    text: 'Crop residue, garbage, firewood, coal and cow-dung cooking fuel.',
    makes: 'PM2.5, PM10, CO',
  },
  {
    icon: Construction,
    title: 'Construction and road dust',
    text: 'Building work, demolition, unpaved roads and dust re-lifted by traffic.',
    makes: 'PM10, PM2.5',
  },
  {
    icon: Sparkles,
    title: 'Firecrackers and festivals',
    text: 'Fireworks and bonfires release a burst of smoke and metals into the air in a few hours.',
    makes: 'PM2.5, SO₂, PM10',
  },
  {
    icon: CloudFog,
    title: 'Weather',
    text: 'In winter, cold air near the ground with little wind acts like a lid and traps pollution close to where we breathe.',
    makes: 'Makes every pollutant worse',
  },
]

export const AQI_MEANING: Record<string, string> = {
  good: 'Little or no risk. Normal activity is fine.',
  moderate: 'Acceptable for most people. Unusually sensitive people may notice symptoms.',
  poor: 'May cause discomfort to people with lung or heart disease, children and older adults.',
  veryPoor: 'Likely to affect most people on longer exposure; serious for sensitive groups.',
  severe: 'Affects everyone, and can cause serious problems for people already unwell.',
}

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'How is the AQI number worked out?',
    a: 'Each pollutant is converted to its own score on the same scale. The AQI you see is the highest of those scores, so one bad pollutant (often PM2.5) sets the number even if the others are fine.',
  },
  {
    q: 'Can I tell the air is bad just by looking?',
    a: 'Not always. Haze and smell give hints, but fine particles can be harmful when the sky looks clear, and gases such as carbon monoxide are invisible and odourless. Check the numbers.',
  },
  {
    q: 'Why is the air usually worse in winter?',
    a: 'Cold, still air and a layer of warmer air above it (a temperature inversion) trap pollution near the ground. Burning for warmth, and crop-residue burning in some regions, add even more.',
  },
  {
    q: 'Do cloth or surgical masks protect me?',
    a: 'They stop large droplets and dust but filter very little fine PM2.5. A well-sealed N95 / FFP2 mask works much better. Gaps around the nose and cheeks let polluted air straight in.',
  },
  {
    q: 'Is the air indoors always cleaner?',
    a: 'Often, but not always. Cooking smoke, incense, mosquito coils, tobacco and unvented stoves can make indoor air worse. A HEPA purifier removes particles, but not gases like carbon monoxide.',
  },
  {
    q: 'Does rain clear the air?',
    a: 'Heavy rain and strong wind usually wash particles out and bring AQI down for a while. Light drizzle helps less, and pollution can build up again within days.',
  },
]
