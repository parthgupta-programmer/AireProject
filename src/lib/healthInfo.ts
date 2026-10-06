import type { AqiKey } from '@/lib/aqi'

export const AQI_ORDER: AqiKey[] = ['good', 'moderate', 'poor', 'veryPoor', 'severe']

/** What to do right now, by AQI category. Always ordered most important first. */
export const MEASURES: Record<AqiKey, string[]> = {
  good: [
    'Enjoy outdoor activity and exercise as usual.',
    'Open windows to let fresh air through your home.',
    'Good day for children to play outside.',
  ],
  moderate: [
    'Most people can carry on normally. Unusually sensitive people should cut down on long, heavy exertion outdoors.',
    'People with asthma or heart conditions: keep your inhaler or medicines within reach.',
    'Ventilate your home in the afternoon, when the air is usually cleaner.',
  ],
  poor: [
    'Limit prolonged or strenuous outdoor activity, especially near busy roads.',
    'Wear a well-fitted N95 / FFP2 mask outdoors. Cloth and surgical masks filter very little fine dust.',
    'Keep windows closed during morning and evening peaks; run a HEPA air purifier if you have one.',
    'Do not burn waste, leaves or firecrackers, and avoid smoking or incense indoors.',
    'Stay hydrated. Rinsing your nose with saline can ease irritation.',
  ],
  veryPoor: [
    'Avoid outdoor exercise and sports. Move children’s activities indoors.',
    'Wear an N95 / FFP2 mask for any trip outside, and keep trips short.',
    'Keep windows and doors shut and run a HEPA purifier in the room you use most.',
    'Choose routes away from heavy traffic; avoid peak rush hours.',
    'Children, older adults and people with lung or heart disease should follow their doctor’s plan closely.',
  ],
  severe: [
    'Stay indoors with windows and doors closed. Postpone outdoor work, exercise and school sports.',
    'If you must go out, wear a fitted N95 / FFP2 mask and limit the time.',
    'Run a HEPA purifier continuously; avoid anything that adds indoor smoke (incense, frying, tobacco).',
    'Check on older relatives, young children and anyone with breathing or heart problems.',
    'Seek medical help quickly for breathlessness, chest pain, or a cough that will not settle.',
  ],
}

export interface HealthCondition {
  name: string
  detail: string
  /** The lowest AQI category at which this becomes a realistic concern. */
  from: AqiKey
}

export const CONDITIONS: HealthCondition[] = [
  {
    name: 'Eye, nose and throat irritation',
    detail: 'Watery or red eyes (including conjunctivitis), sneezing, sore throat, allergic rhinitis and dry cough.',
    from: 'moderate',
  },
  {
    name: 'Asthma attacks and wheezing',
    detail: 'Fine particles and ozone inflame the airways, triggering breathlessness and attacks.',
    from: 'moderate',
  },
  {
    name: 'Respiratory infections',
    detail:
      'Colds, flu, bronchitis and pneumonia. Polluted air does not carry the germs itself, but it damages the lungs’ defences, so infections catch more easily and hit harder.',
    from: 'poor',
  },
  {
    name: 'Bronchitis and COPD flare-ups',
    detail: 'Persistent cough, mucus and shortness of breath get worse, sometimes needing hospital care.',
    from: 'poor',
  },
  {
    name: 'Headache, fatigue and dizziness',
    detail: 'Common on high-pollution days, particularly with carbon monoxide and traffic fumes.',
    from: 'poor',
  },
  {
    name: 'Skin problems',
    detail: 'Itching, rashes and eczema flare-ups from pollutants settling on the skin.',
    from: 'poor',
  },
  {
    name: 'Heart attack, high blood pressure and stroke',
    detail: 'PM2.5 enters the bloodstream and strains blood vessels; risk rises within hours to days of exposure.',
    from: 'veryPoor',
  },
]

export const LONG_TERM_RISKS = [
  'Reduced lung growth and function in children',
  'Chronic bronchitis, COPD and lung cancer',
  'Heart disease and stroke',
  'Low birth weight and preterm birth in pregnancy',
]

export const HIGH_RISK_GROUPS = [
  'Children and teenagers',
  'Pregnant women',
  'Adults over 60',
  'People with asthma, COPD, heart disease or diabetes',
  'Outdoor workers, traffic police and delivery riders',
]
