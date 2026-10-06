/**
 * Monitored places: major cities of every Indian state and union territory.
 *
 * `baseAqi` is only used by the mock service to give each city a believable typical level
 * (north Indian plains high, coast / hills / north-east low). Remove it when real data arrives.
 */
import type { LocationOption } from '@/types/airQuality'

export interface IndiaLocation extends LocationOption {
  baseAqi: number
}

export const STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana',
  'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana',
  'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const

export const UNION_TERRITORIES = [
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi',
  'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const

const UT_SET = new Set<string>(UNION_TERRITORIES)

// [name, state / UT, latitude, longitude, typical AQI]
type Row = [string, string, number, number, number]

const ROWS: Row[] = [
  // Andhra Pradesh
  ['Visakhapatnam', 'Andhra Pradesh', 17.6868, 83.2185, 95],
  ['Vijayawada', 'Andhra Pradesh', 16.5062, 80.648, 105],
  ['Amaravati', 'Andhra Pradesh', 16.5731, 80.3578, 90],
  ['Guntur', 'Andhra Pradesh', 16.3067, 80.4365, 100],
  ['Nellore', 'Andhra Pradesh', 14.4426, 79.9865, 80],
  ['Tirupati', 'Andhra Pradesh', 13.6288, 79.4192, 70],
  ['Kurnool', 'Andhra Pradesh', 15.8281, 78.0373, 90],
  // Arunachal Pradesh
  ['Itanagar', 'Arunachal Pradesh', 27.0844, 93.6053, 55],
  // Assam
  ['Guwahati', 'Assam', 26.1445, 91.7362, 125],
  ['Silchar', 'Assam', 24.8333, 92.7789, 90],
  ['Dibrugarh', 'Assam', 27.4728, 94.912, 80],
  ['Jorhat', 'Assam', 26.7509, 94.2037, 75],
  // Bihar
  ['Patna', 'Bihar', 25.5941, 85.1376, 175],
  ['Gaya', 'Bihar', 24.7914, 85.0002, 140],
  ['Muzaffarpur', 'Bihar', 26.1209, 85.3647, 170],
  ['Bhagalpur', 'Bihar', 25.2425, 86.9842, 150],
  // Chhattisgarh
  ['Raipur', 'Chhattisgarh', 21.2514, 81.6296, 140],
  ['Bhilai', 'Chhattisgarh', 21.1938, 81.3509, 135],
  ['Bilaspur', 'Chhattisgarh', 22.0797, 82.1409, 120],
  ['Korba', 'Chhattisgarh', 22.3595, 82.7501, 150],
  // Goa
  ['Panaji', 'Goa', 15.4909, 73.8278, 55],
  ['Margao', 'Goa', 15.2832, 73.9862, 52],
  // Gujarat
  ['Ahmedabad', 'Gujarat', 23.0225, 72.5714, 125],
  ['Gandhinagar', 'Gujarat', 23.2156, 72.6369, 110],
  ['Surat', 'Gujarat', 21.1702, 72.8311, 100],
  ['Vadodara', 'Gujarat', 22.3072, 73.1812, 115],
  ['Rajkot', 'Gujarat', 22.3039, 70.8022, 95],
  // Haryana
  ['Gurugram', 'Haryana', 28.4595, 77.0266, 170],
  ['Faridabad', 'Haryana', 28.4089, 77.3178, 180],
  ['Rohtak', 'Haryana', 28.8955, 76.6066, 175],
  ['Panipat', 'Haryana', 29.3909, 76.9635, 180],
  ['Karnal', 'Haryana', 29.6857, 76.9905, 160],
  ['Hisar', 'Haryana', 29.1492, 75.7217, 165],
  ['Ambala', 'Haryana', 30.3782, 76.7767, 135],
  // Himachal Pradesh
  ['Shimla', 'Himachal Pradesh', 31.1048, 77.1734, 55],
  ['Dharamshala', 'Himachal Pradesh', 32.219, 76.3234, 50],
  ['Baddi', 'Himachal Pradesh', 30.9578, 76.7914, 120],
  // Jharkhand
  ['Ranchi', 'Jharkhand', 23.3441, 85.3096, 115],
  ['Jamshedpur', 'Jharkhand', 22.8046, 86.2029, 125],
  ['Dhanbad', 'Jharkhand', 23.7957, 86.4304, 175],
  ['Bokaro', 'Jharkhand', 23.6693, 86.1511, 150],
  // Karnataka
  ['Bengaluru', 'Karnataka', 12.9716, 77.5946, 64],
  ['Mysuru', 'Karnataka', 12.2958, 76.6394, 55],
  ['Mangaluru', 'Karnataka', 12.9141, 74.856, 50],
  ['Hubballi', 'Karnataka', 15.3647, 75.124, 70],
  ['Belagavi', 'Karnataka', 15.8497, 74.4977, 65],
  ['Kalaburagi', 'Karnataka', 17.3297, 76.8343, 85],
  // Kerala
  ['Thiruvananthapuram', 'Kerala', 8.5241, 76.9366, 45],
  ['Kochi', 'Kerala', 9.9312, 76.2673, 55],
  ['Kozhikode', 'Kerala', 11.2588, 75.7804, 48],
  ['Thrissur', 'Kerala', 10.5276, 76.2144, 50],
  ['Kollam', 'Kerala', 8.8932, 76.6141, 50],
  // Madhya Pradesh
  ['Bhopal', 'Madhya Pradesh', 23.2599, 77.4126, 115],
  ['Indore', 'Madhya Pradesh', 22.7196, 75.8577, 105],
  ['Gwalior', 'Madhya Pradesh', 26.2183, 78.1828, 155],
  ['Jabalpur', 'Madhya Pradesh', 23.1815, 79.9864, 110],
  ['Ujjain', 'Madhya Pradesh', 23.1765, 75.7885, 100],
  // Maharashtra
  ['Mumbai', 'Maharashtra', 19.076, 72.8777, 98],
  ['Navi Mumbai', 'Maharashtra', 19.033, 73.0297, 100],
  ['Thane', 'Maharashtra', 19.2183, 72.9781, 105],
  ['Pune', 'Maharashtra', 18.5204, 73.8567, 90],
  ['Nagpur', 'Maharashtra', 21.1458, 79.0882, 110],
  ['Nashik', 'Maharashtra', 19.9975, 73.7898, 85],
  ['Chhatrapati Sambhajinagar', 'Maharashtra', 19.8762, 75.3433, 85],
  ['Solapur', 'Maharashtra', 17.6599, 75.9064, 85],
  ['Kolhapur', 'Maharashtra', 16.705, 74.2433, 70],
  ['Chandrapur', 'Maharashtra', 19.9615, 79.2961, 135],
  // Manipur
  ['Imphal', 'Manipur', 24.817, 93.9368, 60],
  // Meghalaya
  ['Shillong', 'Meghalaya', 25.5788, 91.8933, 45],
  ['Byrnihat', 'Meghalaya', 26.0333, 91.8667, 190],
  // Mizoram
  ['Aizawl', 'Mizoram', 23.7271, 92.7176, 35],
  // Nagaland
  ['Kohima', 'Nagaland', 25.6751, 94.1086, 45],
  ['Dimapur', 'Nagaland', 25.9063, 93.7276, 80],
  // Odisha
  ['Bhubaneswar', 'Odisha', 20.2961, 85.8245, 95],
  ['Cuttack', 'Odisha', 20.4625, 85.883, 105],
  ['Rourkela', 'Odisha', 22.2604, 84.8536, 120],
  ['Puri', 'Odisha', 19.8135, 85.8312, 70],
  ['Talcher', 'Odisha', 20.95, 85.2167, 160],
  // Punjab
  ['Ludhiana', 'Punjab', 30.901, 75.8573, 165],
  ['Amritsar', 'Punjab', 31.634, 74.8723, 150],
  ['Jalandhar', 'Punjab', 31.326, 75.5762, 150],
  ['Patiala', 'Punjab', 30.3398, 76.3869, 145],
  ['Bathinda', 'Punjab', 30.211, 74.9455, 150],
  ['Mohali', 'Punjab', 30.7046, 76.7179, 130],
  ['Mandi Gobindgarh', 'Punjab', 30.6667, 76.3, 190],
  // Rajasthan
  ['Jaipur', 'Rajasthan', 26.9124, 75.7873, 140],
  ['Jodhpur', 'Rajasthan', 26.2389, 73.0243, 120],
  ['Udaipur', 'Rajasthan', 24.5854, 73.7125, 80],
  ['Kota', 'Rajasthan', 25.2138, 75.8648, 125],
  ['Ajmer', 'Rajasthan', 26.4499, 74.6399, 110],
  ['Bikaner', 'Rajasthan', 28.0229, 73.3119, 120],
  ['Alwar', 'Rajasthan', 27.553, 76.6346, 170],
  ['Bhiwadi', 'Rajasthan', 28.2104, 76.8603, 200],
  // Sikkim
  ['Gangtok', 'Sikkim', 27.3314, 88.6138, 35],
  // Tamil Nadu
  ['Chennai', 'Tamil Nadu', 13.0827, 80.2707, 85],
  ['Coimbatore', 'Tamil Nadu', 11.0168, 76.9558, 65],
  ['Madurai', 'Tamil Nadu', 9.9252, 78.1198, 72],
  ['Tiruchirappalli', 'Tamil Nadu', 10.7905, 78.7047, 75],
  ['Salem', 'Tamil Nadu', 11.6643, 78.146, 70],
  ['Vellore', 'Tamil Nadu', 12.9165, 79.1325, 80],
  ['Tirunelveli', 'Tamil Nadu', 8.7139, 77.7567, 55],
  ['Thoothukudi', 'Tamil Nadu', 8.7642, 78.1348, 60],
  // Telangana
  ['Hyderabad', 'Telangana', 17.385, 78.4867, 100],
  ['Warangal', 'Telangana', 17.9689, 79.5941, 85],
  ['Nizamabad', 'Telangana', 18.6725, 78.0941, 80],
  ['Karimnagar', 'Telangana', 18.4386, 79.1288, 80],
  // Tripura
  ['Agartala', 'Tripura', 23.8315, 91.2868, 70],
  // Uttar Pradesh
  ['Lucknow', 'Uttar Pradesh', 26.8467, 80.9462, 150],
  ['Ghaziabad', 'Uttar Pradesh', 28.6692, 77.4538, 165],
  ['Noida', 'Uttar Pradesh', 28.5355, 77.391, 180],
  ['Greater Noida', 'Uttar Pradesh', 28.4744, 77.504, 175],
  ['Kanpur', 'Uttar Pradesh', 26.4499, 80.3319, 175],
  ['Varanasi', 'Uttar Pradesh', 25.3176, 82.9739, 155],
  ['Agra', 'Uttar Pradesh', 27.1767, 78.0081, 160],
  ['Prayagraj', 'Uttar Pradesh', 25.4358, 81.8463, 145],
  ['Meerut', 'Uttar Pradesh', 28.9845, 77.7064, 175],
  ['Bareilly', 'Uttar Pradesh', 28.367, 79.4304, 150],
  ['Gorakhpur', 'Uttar Pradesh', 26.7606, 83.3732, 150],
  ['Moradabad', 'Uttar Pradesh', 28.8386, 78.7733, 160],
  ['Aligarh', 'Uttar Pradesh', 27.8974, 78.088, 160],
  ['Jhansi', 'Uttar Pradesh', 25.4484, 78.5685, 130],
  ['Muzaffarnagar', 'Uttar Pradesh', 29.4727, 77.7085, 165],
  // Uttarakhand
  ['Dehradun', 'Uttarakhand', 30.3165, 78.0322, 100],
  ['Haridwar', 'Uttarakhand', 29.9457, 78.1642, 110],
  ['Rishikesh', 'Uttarakhand', 30.0869, 78.2676, 85],
  ['Haldwani', 'Uttarakhand', 29.2183, 79.513, 100],
  ['Kashipur', 'Uttarakhand', 29.2104, 78.9619, 140],
  // West Bengal
  ['Kolkata', 'West Bengal', 22.5726, 88.3639, 132],
  ['Howrah', 'West Bengal', 22.5958, 88.2636, 135],
  ['Durgapur', 'West Bengal', 23.5204, 87.3119, 125],
  ['Asansol', 'West Bengal', 23.6739, 86.9524, 130],
  ['Siliguri', 'West Bengal', 26.7271, 88.3953, 110],
  ['Kharagpur', 'West Bengal', 22.346, 87.232, 105],

  // ---- Union territories ----
  ['Port Blair', 'Andaman and Nicobar Islands', 11.6234, 92.7265, 25],
  ['Chandigarh', 'Chandigarh', 30.7333, 76.7794, 110],
  ['Daman', 'Dadra and Nagar Haveli and Daman and Diu', 20.3974, 72.8328, 70],
  ['Silvassa', 'Dadra and Nagar Haveli and Daman and Diu', 20.2766, 73.0169, 75],
  ['Delhi', 'Delhi', 28.6139, 77.209, 178],
  ['Srinagar', 'Jammu and Kashmir', 34.0837, 74.7973, 75],
  ['Jammu', 'Jammu and Kashmir', 32.7266, 74.857, 110],
  ['Anantnag', 'Jammu and Kashmir', 33.7311, 75.1487, 70],
  ['Leh', 'Ladakh', 34.1526, 77.5771, 35],
  ['Kargil', 'Ladakh', 34.5539, 76.1349, 30],
  ['Kavaratti', 'Lakshadweep', 10.5667, 72.6417, 25],
  ['Puducherry', 'Puducherry', 11.9416, 79.8083, 60],
  ['Karaikal', 'Puducherry', 10.9254, 79.838, 55],
]

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

export const INDIA_LOCATIONS: IndiaLocation[] = ROWS.map(([name, region, latitude, longitude, baseAqi]) => ({
  id: slug(name),
  name,
  region,
  regionType: UT_SET.has(region) ? 'Union Territory' : 'State',
  country: 'India',
  latitude,
  longitude,
  baseAqi,
}))
