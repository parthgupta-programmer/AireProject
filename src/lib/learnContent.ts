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
  {
    q: 'Why do forecasts sometimes differ from the sensor reading?',
    a: 'The forecast is a machine-learning prediction trained on historical patterns. It cannot react instantly to sudden changes such as a nearby fire or dust storm. The sensor reading reflects what is actually measured right now at a specific station.',
  },
  {
    q: 'What is the difference between µg/m³ and AQI?',
    a: 'µg/m³ (micrograms per cubic metre) is the raw physical concentration measured by a sensor. The AQI converts that into a 0–500 score using a non-linear formula, so the health risk is easier to interpret. A doubling of concentration does not mean a doubling of AQI.',
  },
  {
    q: 'How accurate is the route pollution estimate?',
    a: 'Route exposure is estimated using AQI data from the nearest available monitoring stations. Pollution can vary significantly over short distances due to traffic, wind, and local sources. Treat the route estimate as a relative guide, not a precise measurement of what you will breathe at every point.',
  },
]

// ── AQI vs Pollutant Concentration ─────────────────────────────────────────────

export interface ConceptCard {
  title: string
  body: string
  detail: string
}

export const AQI_VS_CONCENTRATION: ConceptCard[] = [
  {
    title: 'Raw concentration (µg/m³)',
    body: 'A sensor measures how many micrograms of a pollutant are present in each cubic metre of air. This is an objective physical quantity that does not change with location or regulatory system.',
    detail:
      'Example: PM2.5 at 60 µg/m³ means 60 millionths of a gram of fine particles in every cubic metre of air you breathe.',
  },
  {
    title: 'Sub-index calculation',
    body: 'Each country or agency converts raw concentrations into a 0–500 sub-index using a piecewise linear formula. The breakpoints differ between India (CPCB NAQI), the US (US EPA AQI), and the EU.',
    detail:
      'Because the formula is non-linear, doubling the PM2.5 concentration from 30 to 60 µg/m³ does not double the AQI. The jump grows larger in the higher danger ranges.',
  },
  {
    title: 'The reported AQI',
    body: 'The overall AQI is the maximum sub-index across all measured pollutants. One badly polluted gas or particle type sets the whole number, even if the others are fine.',
    detail:
      'This app uses the India CPCB National AQI (NAQI) scale: Good (0–50), Satisfactory (51–100), Moderate (101–200), Poor (201–300), Very Poor (301–400), Severe (401–500).',
  },
  {
    title: 'Why both numbers matter',
    body: 'AQI tells you the overall health risk category at a glance. Raw concentrations let you compare readings across different countries or check against WHO guideline values.',
    detail:
      'WHO\'s 24-hour guideline for PM2.5 is 15 µg/m³. That maps to an NAQI of roughly 65, which is in the "Satisfactory" band — but still above the WHO safe threshold.',
  },
]

// ── Weather and Atmospheric Influence ─────────────────────────────────────────

export interface WeatherFactor {
  title: string
  icon: string
  body: string
  tip: string
}

export const WEATHER_FACTORS: WeatherFactor[] = [
  {
    title: 'Boundary layer height',
    icon: '🌫',
    body: 'The planetary boundary layer (PBL) is the slice of atmosphere close to the ground where emissions mix. In summer afternoons the PBL can reach 1–2 km, dispersing pollutants widely. In winter mornings it collapses to 200 m or less, concentrating everything near breathing height.',
    tip: 'Readings taken in the early morning often show the day\'s peak because the boundary layer has not yet grown.',
  },
  {
    title: 'Temperature inversions',
    icon: '🌡',
    body: 'Normally, air temperature decreases with altitude, so warm, buoyant polluted air rises and disperses. During an inversion, a layer of warm air sits above cold surface air and acts like a lid, trapping pollution below it.',
    tip: 'Inversions are most common on cold, calm, clear winter nights. Strong sun usually breaks them by mid-morning.',
  },
  {
    title: 'Wind speed and direction',
    icon: '💨',
    body: 'Strong wind dilutes and disperses pollution rapidly. Calm conditions allow concentrations to build. Wind direction determines whether you are downwind of an industrial zone, a motorway, or a cleaner rural area.',
    tip: 'On calm days, moving even a few streets away from a busy road can noticeably reduce exposure.',
  },
  {
    title: 'Rainfall and wet deposition',
    icon: '🌧',
    body: 'Rain scavenges particles from the air. Heavy rain with large droplets is most effective; light drizzle washes PM10 but misses much of the fine PM2.5. SO₂ and NO₂ dissolve in rainwater and are deposited as acid rain.',
    tip: 'AQI typically drops within hours of heavy rain, then climbs again as fresh emissions build up.',
  },
  {
    title: 'Sunlight and photochemistry',
    icon: '☀️',
    body: 'Sunlight drives chemical reactions between nitrogen oxides and volatile organic compounds (VOCs) to form ground-level ozone. O₃ peaks on hot, sunny afternoons in cities and is lower overnight and in winter.',
    tip: 'For ozone, exercise in the early morning or after sunset rather than in the afternoon.',
  },
  {
    title: 'Humidity',
    icon: '💧',
    body: 'High humidity causes hygroscopic particles (ones that absorb water) to swell, increasing their mass and optical density. This creates visible haze even at moderate PM2.5 concentrations. Some sensor types overestimate PM in high humidity.',
    tip: 'Low-cost optical particle sensors may report inflated PM2.5 when relative humidity exceeds 80%.',
  },
]

// ── Data Sources and Forecast Limitations ────────────────────────────────────

export interface DataSourceCard {
  title: string
  type: 'observed' | 'forecast' | 'route'
  description: string
  strengths: string[]
  limitations: string[]
}

export const DATA_SOURCE_CARDS: DataSourceCard[] = [
  {
    title: 'Real-time observations',
    type: 'observed',
    description:
      'Measurements from a fixed monitoring station (CPCB, OpenAQ, or similar) at a specific geographic point. The timestamp indicates when the sensor recorded that reading.',
    strengths: [
      'Reflects actual physical conditions at the sensor location',
      'Has a precise observation timestamp',
      'Can be used to verify forecast accuracy',
    ],
    limitations: [
      'Only represents one point; air quality varies within a city',
      'Sensor outages or calibration issues can produce spikes or gaps',
      'Data may be delayed by minutes to hours depending on the provider',
      'Dense urban areas with single stations may miss local hotspots',
    ],
  },
  {
    title: 'ML-based AQI forecast',
    type: 'forecast',
    description:
      'A machine-learning model trained on historical AQI patterns. It predicts likely AQI values for future hours or days based on time-of-day and historical trends — not on real-time weather or emissions.',
    strengths: [
      'Gives advance notice to plan activities',
      'Useful when monitoring stations are offline',
      'Can capture seasonal and diurnal patterns',
    ],
    limitations: [
      'Cannot predict sudden events: fires, dust storms, or accidents',
      'Accuracy decreases beyond a few hours',
      'The model is trained on historical data and may not reflect new emission sources',
      'Should never be treated as a measured observation — it is a statistical estimate',
    ],
  },
  {
    title: 'Route exposure estimate',
    type: 'route',
    description:
      'An approximation of the pollution you might encounter along a planned journey, calculated by combining AQI readings from nearby monitoring stations with the route geometry.',
    strengths: [
      'Enables comparison of alternative routes',
      'Highlights which road segments may be more polluted',
      'Integrates with navigation for practical decisions',
    ],
    limitations: [
      'Station coverage is sparse; estimates rely on spatial interpolation',
      'Traffic-generated pollution spikes are not captured in real time',
      'AQI at street level can differ significantly from the nearest monitoring station',
      'Does not account for your breathing rate, walking vs cycling vs driving, or exposure duration',
      'Treat as a relative guide, not a personalised health measurement',
    ],
  },
]
