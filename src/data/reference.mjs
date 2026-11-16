/** Reference lists. Upserts must not overwrite rows that already exist. */

export const ZONES = ["NORTH", "SOUTH", "EAST", "WEST", "CENTRAL"];

export const STATES = [
  ["Andhra Pradesh", "AP", "SOUTH"],
  ["Arunachal Pradesh", "AR", "EAST"],
  ["Assam", "AS", "EAST"],
  ["Bihar", "BR", "EAST"],
  ["Chhattisgarh", "CG", "CENTRAL"],
  ["Goa", "GA", "WEST"],
  ["Gujarat", "GJ", "WEST"],
  ["Haryana", "HR", "NORTH"],
  ["Himachal Pradesh", "HP", "NORTH"],
  ["Jharkhand", "JH", "EAST"],
  ["Karnataka", "KA", "SOUTH"],
  ["Kerala", "KL", "SOUTH"],
  ["Madhya Pradesh", "MP", "CENTRAL"],
  ["Maharashtra", "MH", "WEST"],
  ["Manipur", "MN", "EAST"],
  ["Meghalaya", "ML", "EAST"],
  ["Mizoram", "MZ", "EAST"],
  ["Nagaland", "NL", "EAST"],
  ["Odisha", "OD", "EAST"],
  ["Punjab", "PB", "NORTH"],
  ["Rajasthan", "RJ", "NORTH"],
  ["Sikkim", "SK", "EAST"],
  ["Tamil Nadu", "TN", "SOUTH"],
  ["Telangana", "TS", "SOUTH"],
  ["Tripura", "TR", "EAST"],
  ["Uttar Pradesh", "UP", "NORTH"],
  ["Uttarakhand", "UK", "NORTH"],
  ["West Bengal", "WB", "EAST"],
  ["Andaman and Nicobar Islands", "AN", "SOUTH"],
  ["Chandigarh", "CH", "NORTH"],
  ["Dadra and Nagar Haveli and Daman and Diu", "DH", "WEST"],
  ["Delhi", "DL", "NORTH"],
  ["Jammu and Kashmir", "JK", "NORTH"],
  ["Ladakh", "LA", "NORTH"],
  ["Lakshadweep", "LD", "SOUTH"],
  ["Puducherry", "PY", "SOUTH"],
];

const RAW = `
Andhra Pradesh|Alluri Sitharama Raju|Anakapalli|Anantapur|Annamayya|Bapatla|Chittoor|Dr. B.R. Ambedkar Konaseema|East Godavari|Eluru|Guntur|Kakinada|Krishna|Kurnool|Nandyal|NTR|Palnadu|Parvathipuram Manyam|Prakasam|Sri Potti Sriramulu Nellore|Sri Sathya Sai|Srikakulam|Tirupati|Visakhapatnam|Vizianagaram|West Godavari|YSR Kadapa
Arunachal Pradesh|Anjaw|Changlang|Dibang Valley|East Kameng|East Siang|Kamle|Kra Daadi|Kurung Kumey|Lepa Rada|Lohit|Longding|Lower Dibang Valley|Lower Siang|Lower Subansiri|Namsai|Pakke Kessang|Papum Pare|Shi Yomi|Siang|Tawang|Tirap|Upper Siang|Upper Subansiri|West Kameng|West Siang
Assam|Bajali|Baksa|Barpeta|Biswanath|Bongaigaon|Cachar|Charaideo|Chirang|Darrang|Dhemaji|Dhubri|Dibrugarh|Dima Hasao|Goalpara|Golaghat|Hailakandi|Hojai|Jorhat|Kamrup|Kamrup Metropolitan|Karbi Anglong|Karimganj|Kokrajhar|Lakhimpur|Majuli|Morigaon|Nagaon|Nalbari|Sivasagar|Sonitpur|South Salmara-Mankachar|Tamulpur|Tinsukia|Udalguri|West Karbi Anglong
Bihar|Araria|Arwal|Aurangabad|Banka|Begusarai|Bhagalpur|Bhojpur|Buxar|Darbhanga|East Champaran|Gaya|Gopalganj|Jamui|Jehanabad|Kaimur|Katihar|Khagaria|Kishanganj|Lakhisarai|Madhepura|Madhubani|Munger|Muzaffarpur|Nalanda|Nawada|Patna|Purnia|Rohtas|Saharsa|Samastipur|Saran|Sheikhpura|Sheohar|Sitamarhi|Siwan|Supaul|Vaishali|West Champaran
Chhattisgarh|Balod|Baloda Bazar|Balrampur|Bastar|Bemetara|Bijapur|Bilaspur|Dantewada|Dhamtari|Durg|Gariaband|Gaurela-Pendra-Marwahi|Janjgir-Champa|Jashpur|Kabirdham|Kanker|Khairagarh-Chhuikhadan-Gandai|Kondagaon|Korba|Korea|Mahasamund|Manendragarh-Chirmiri-Bharatpur|Mohla-Manpur-Ambagarh Chowki|Mungeli|Narayanpur|Raigarh|Raipur|Rajnandgaon|Sakti|Sarangarh-Bilaigarh|Sukma|Surajpur|Surguja
Goa|North Goa|South Goa
Gujarat|Ahmedabad|Amreli|Anand|Aravalli|Banaskantha|Bharuch|Bhavnagar|Botad|Chhota Udaipur|Dahod|Dang|Devbhumi Dwarka|Gandhinagar|Gir Somnath|Jamnagar|Junagadh|Kheda|Kutch|Mahisagar|Mehsana|Morbi|Narmada|Navsari|Panchmahal|Patan|Porbandar|Rajkot|Sabarkantha|Surat|Surendranagar|Tapi|Vadodara|Valsad
Haryana|Ambala|Bhiwani|Charkhi Dadri|Faridabad|Fatehabad|Gurugram|Hisar|Jhajjar|Jind|Kaithal|Karnal|Kurukshetra|Mahendragarh|Nuh|Palwal|Panchkula|Panipat|Rewari|Rohtak|Sirsa|Sonipat|Yamunanagar
Himachal Pradesh|Bilaspur|Chamba|Hamirpur|Kangra|Kinnaur|Kullu|Lahaul and Spiti|Mandi|Shimla|Sirmaur|Solan|Una
Jharkhand|Bokaro|Chatra|Deoghar|Dhanbad|Dumka|East Singhbhum|Garhwa|Giridih|Godda|Gumla|Hazaribagh|Jamtara|Khunti|Koderma|Latehar|Lohardaga|Pakur|Palamu|Ramgarh|Ranchi|Sahebganj|Seraikela-Kharsawan|Simdega|West Singhbhum
Karnataka|Bagalkot|Ballari|Belagavi|Bengaluru Rural|Bengaluru Urban|Bidar|Chamarajanagar|Chikkaballapur|Chikkamagaluru|Chitradurga|Dakshina Kannada|Davanagere|Dharwad|Gadag|Hassan|Haveri|Kalaburagi|Kodagu|Kolar|Koppal|Mandya|Mysuru|Raichur|Ramanagara|Shivamogga|Tumakuru|Udupi|Uttara Kannada|Vijayanagara|Vijayapura|Yadgir
Kerala|Alappuzha|Ernakulam|Idukki|Kannur|Kasaragod|Kollam|Kottayam|Kozhikode|Malappuram|Palakkad|Pathanamthitta|Thiruvananthapuram|Thrissur|Wayanad
Madhya Pradesh|Agar Malwa|Alirajpur|Anuppur|Ashoknagar|Balaghat|Barwani|Betul|Bhind|Bhopal|Burhanpur|Chhatarpur|Chhindwara|Damoh|Datia|Dewas|Dhar|Dindori|Guna|Gwalior|Harda|Indore|Jabalpur|Jhabua|Katni|Khandwa|Khargone|Maihar|Mandla|Mandsaur|Mauganj|Morena|Narmadapuram|Narsinghpur|Neemuch|Niwari|Panna|Pandhurna|Raisen|Rajgarh|Ratlam|Rewa|Sagar|Satna|Sehore|Seoni|Shahdol|Shajapur|Sheopur|Shivpuri|Sidhi|Singrauli|Tikamgarh|Ujjain|Umaria|Vidisha
Maharashtra|Ahmednagar|Akola|Amravati|Beed|Bhandara|Buldhana|Chandrapur|Chhatrapati Sambhajinagar|Dharashiv|Dhule|Gadchiroli|Gondia|Hingoli|Jalgaon|Jalna|Kolhapur|Latur|Mumbai City|Mumbai Suburban|Nagpur|Nanded|Nandurbar|Nashik|Palghar|Parbhani|Pune|Raigad|Ratnagiri|Sangli|Satara|Sindhudurg|Solapur|Thane|Wardha|Washim|Yavatmal
Manipur|Bishnupur|Chandel|Churachandpur|Imphal East|Imphal West|Jiribam|Kakching|Kamjong|Kangpokpi|Noney|Pherzawl|Senapati|Tamenglong|Tengnoupal|Thoubal|Ukhrul
Meghalaya|Eastern West Khasi Hills|East Garo Hills|East Jaintia Hills|East Khasi Hills|North Garo Hills|Ri Bhoi|South Garo Hills|South West Garo Hills|South West Khasi Hills|West Garo Hills|West Jaintia Hills|West Khasi Hills
Mizoram|Aizawl|Champhai|Hnahthial|Khawzawl|Kolasib|Lawngtlai|Lunglei|Mamit|Saiha|Saitual|Serchhip
Nagaland|Chumoukedima|Dimapur|Kiphire|Kohima|Longleng|Mokokchung|Mon|Niuland|Noklak|Peren|Phek|Shamator|Tseminyu|Tuensang|Wokha|Zunheboto
Odisha|Angul|Balangir|Balasore|Bargarh|Bhadrak|Boudh|Cuttack|Deogarh|Dhenkanal|Gajapati|Ganjam|Jagatsinghpur|Jajpur|Jharsuguda|Kalahandi|Kandhamal|Kendrapara|Kendujhar|Khordha|Koraput|Malkangiri|Mayurbhanj|Nabarangpur|Nayagarh|Nuapada|Puri|Rayagada|Sambalpur|Subarnapur|Sundargarh
Punjab|Amritsar|Barnala|Bathinda|Faridkot|Fatehgarh Sahib|Fazilka|Ferozepur|Gurdaspur|Hoshiarpur|Jalandhar|Kapurthala|Ludhiana|Malerkotla|Mansa|Moga|Pathankot|Patiala|Rupnagar|Sahibzada Ajit Singh Nagar|Sangrur|Shahid Bhagat Singh Nagar|Sri Muktsar Sahib|Tarn Taran
Rajasthan|Ajmer|Alwar|Balotra|Banswara|Baran|Barmer|Beawar|Bharatpur|Bhilwara|Bikaner|Bundi|Chittorgarh|Churu|Dausa|Deeg|Dholpur|Dungarpur|Hanumangarh|Jaipur|Jaisalmer|Jalore|Jhalawar|Jhunjhunu|Jodhpur|Karauli|Khairthal-Tijara|Kota|Kotputli-Behror|Nagaur|Pali|Phalodi|Pratapgarh|Rajsamand|Salumbar|Sawai Madhopur|Sikar|Sirohi|Sri Ganganagar|Tonk|Udaipur
Sikkim|Gangtok|Gyalshing|Mangan|Namchi|Pakyong|Soreng
Tamil Nadu|Ariyalur|Chengalpattu|Chennai|Coimbatore|Cuddalore|Dharmapuri|Dindigul|Erode|Kallakurichi|Kancheepuram|Kanniyakumari|Karur|Krishnagiri|Madurai|Mayiladuthurai|Nagapattinam|Namakkal|Nilgiris|Perambalur|Pudukkottai|Ramanathapuram|Ranipet|Salem|Sivaganga|Tenkasi|Thanjavur|Theni|Thoothukudi|Tiruchirappalli|Tirunelveli|Tirupathur|Tiruppur|Tiruvallur|Tiruvannamalai|Tiruvarur|Vellore|Viluppuram|Virudhunagar
Telangana|Adilabad|Bhadradri Kothagudem|Hanamkonda|Hyderabad|Jagtial|Jangaon|Jayashankar Bhupalpally|Jogulamba Gadwal|Kamareddy|Karimnagar|Khammam|Komaram Bheem|Mahabubabad|Mahabubnagar|Mancherial|Medak|Medchal-Malkajgiri|Mulugu|Nagarkurnool|Nalgonda|Narayanpet|Nirmal|Nizamabad|Peddapalli|Rajanna Sircilla|Rangareddy|Sangareddy|Siddipet|Suryapet|Vikarabad|Wanaparthy|Warangal|Yadadri Bhuvanagiri
Tripura|Dhalai|Gomati|Khowai|North Tripura|Sepahijala|South Tripura|Unakoti|West Tripura
Uttar Pradesh|Agra|Aligarh|Ambedkar Nagar|Amethi|Amroha|Auraiya|Ayodhya|Azamgarh|Baghpat|Bahraich|Ballia|Balrampur|Banda|Barabanki|Bareilly|Basti|Bhadohi|Bijnor|Budaun|Bulandshahr|Chandauli|Chitrakoot|Deoria|Etah|Etawah|Farrukhabad|Fatehpur|Firozabad|Gautam Buddha Nagar|Ghaziabad|Ghazipur|Gonda|Gorakhpur|Hamirpur|Hapur|Hardoi|Hathras|Jalaun|Jaunpur|Jhansi|Kannauj|Kanpur Dehat|Kanpur Nagar|Kasganj|Kaushambi|Kheri|Kushinagar|Lalitpur|Lucknow|Maharajganj|Mahoba|Mainpuri|Mathura|Mau|Meerut|Mirzapur|Moradabad|Muzaffarnagar|Pilibhit|Pratapgarh|Prayagraj|Raebareli|Rampur|Saharanpur|Sambhal|Sant Kabir Nagar|Shahjahanpur|Shamli|Shrawasti|Siddharthnagar|Sitapur|Sonbhadra|Sultanpur|Unnao|Varanasi
Uttarakhand|Almora|Bageshwar|Chamoli|Champawat|Dehradun|Haridwar|Nainital|Pauri Garhwal|Pithoragarh|Rudraprayag|Tehri Garhwal|Udham Singh Nagar|Uttarkashi
West Bengal|Alipurduar|Bankura|Birbhum|Cooch Behar|Dakshin Dinajpur|Darjeeling|Hooghly|Howrah|Jalpaiguri|Jhargram|Kalimpong|Kolkata|Malda|Murshidabad|Nadia|North 24 Parganas|Paschim Bardhaman|Paschim Medinipur|Purba Bardhaman|Purba Medinipur|Purulia|South 24 Parganas|Uttar Dinajpur
Andaman and Nicobar Islands|Nicobar|North and Middle Andaman|South Andaman
Chandigarh|Chandigarh
Dadra and Nagar Haveli and Daman and Diu|Dadra and Nagar Haveli|Daman|Diu
Delhi|Central Delhi|East Delhi|New Delhi|North Delhi|North East Delhi|North West Delhi|Shahdara|South Delhi|South East Delhi|South West Delhi|West Delhi
Jammu and Kashmir|Anantnag|Bandipora|Baramulla|Budgam|Doda|Ganderbal|Jammu|Kathua|Kishtwar|Kulgam|Kupwara|Poonch|Pulwama|Rajouri|Ramban|Reasi|Samba|Shopian|Srinagar|Udhampur
Ladakh|Kargil|Leh
Lakshadweep|Lakshadweep
Puducherry|Karaikal|Mahe|Puducherry|Yanam
`;

export const DISTRICTS = Object.fromEntries(
  RAW.trim().split("\n").map((line) => {
    const [state, ...districts] = line.split("|");
    return [state, districts];
  }),
);

export const CATEGORIES = [
  ["Submersible pump", "PUMPS"],
  ["Monoblock pump", "PUMPS"],
  ["Openwell pump", "PUMPS"],
  ["Jet pump", "PUMPS"],
  ["Surface pump", "PUMPS"],
  ["Motor", "PUMPS"],
  ["Controller", "PUMPS"],
  ["RMS", "PUMPS"],
  ["Solar pump", "PUMPS"],
  ["Solar panel", "SOLAR"],
  ["Rooftop system", "SOLAR"],
  ["Inverter", "SOLAR"],
];

export const PRODUCTS = [
  ["SUB-1HP", "Submersible 1 HP", "Submersible pump", "PUMPS", "SUBMERSIBLE"],
  ["SUB-1.5HP", "Submersible 1.5 HP", "Submersible pump", "PUMPS", "SUBMERSIBLE"],
  ["SUB-2HP", "Submersible 2 HP", "Submersible pump", "PUMPS", "SUBMERSIBLE"],
  ["SUB-3HP", "Submersible 3 HP", "Submersible pump", "PUMPS", "SUBMERSIBLE"],
  ["SUB-5HP", "Submersible 5 HP", "Submersible pump", "PUMPS", "SUBMERSIBLE"],
  ["MONO-1HP", "Monoblock 1 HP", "Monoblock pump", "PUMPS", "MONOBLOCK"],
  ["MONO-1.5HP", "Monoblock 1.5 HP", "Monoblock pump", "PUMPS", "MONOBLOCK"],
  ["OW-1HP", "Openwell 1 HP", "Openwell pump", "PUMPS", "OPENWELL"],
  ["JET-0.5HP", "Jet 0.5 HP", "Jet pump", "PUMPS", "JET"],
  ["SOL-3HP", "Solar pump 3 HP", "Solar pump", "PUMPS", "SOLAR_PUMP"],
  ["SOL-5HP", "Solar pump 5 HP", "Solar pump", "PUMPS", "SOLAR_PUMP"],
  ["SOL-7.5HP", "Solar pump 7.5 HP", "Solar pump", "PUMPS", "SOLAR_PUMP"],
  ["CTRL-AC", "AC controller", "Controller", "PUMPS", "CONTROLLER"],
  ["CTRL-DC", "DC controller", "Controller", "PUMPS", "CONTROLLER"],
  ["RMS-1", "RMS unit", "RMS", "PUMPS", "RMS"],
  ["PANEL-540", "Solar panel 540 W", "Solar panel", "SOLAR", "PANEL"],
  ["ROOF-3KW", "Rooftop 3 kW", "Rooftop system", "SOLAR", "ROOFTOP"],
  ["INV-3KW", "Inverter 3 kW", "Inverter", "SOLAR", "INVERTER"],
  ["INV-5KW", "Inverter 5 kW", "Inverter", "SOLAR", "INVERTER"],
];

export const BRANDS = ["Oswal", "Crompton", "Kirloskar", "CRI", "Texmo", "Lubi", "Shakti", "KSB"];

export const NATURES = [
  "No water",
  "Low discharge",
  "Pump not starting",
  "Tripping",
  "Motor burnt",
  "Cable fault",
  "Panel fault",
  "Controller fault",
  "Bearing noise",
  "Leakage",
  "Installation pending",
  "Warranty inspection",
  "Scheme inspection",
  "Other",
];

export const PROBLEMS = [
  "Winding failure",
  "Capacitor failure",
  "Impeller jammed",
  "Foot valve choked",
  "Dry run",
  "Low voltage",
  "Panel not charging",
  "Inverter fault",
  "RMS offline",
  "Cable joint open",
  "Bearing seized",
  "No fault found",
];

export const SOLUTIONS = [
  "Rewound motor",
  "Replaced capacitor",
  "Cleaned impeller",
  "Replaced foot valve",
  "Replaced cable",
  "Replaced controller",
  "Replaced panel",
  "Reset RMS",
  "Customer advised",
  "No parts used",
];

export const SCHEMES = ["PM-KUSUM", "PM-KUSUM Component B", "PM-KUSUM Component C", "MSEDCL", "State scheme", "Retail"];

export const SOURCES = [
  ["CALL", "Call"],
  ["WHATSAPP", "WhatsApp"],
  ["WEB", "Web form"],
  ["DEALER", "Dealer"],
  ["QR", "QR link"],
  ["OEM", "OEM Partner"],
];

export const HOLDS = ["Customer not available", "Parts awaited", "Site not ready", "Weather", "Payment pending", "Other"];

/** District-headquarter pincodes. A full India file can still be imported as CSV. */
export const PINCODES = [
  ["132001", "Karnal", "Haryana"],
  ["134003", "Ambala", "Haryana"],
  ["127021", "Bhiwani", "Haryana"],
  ["127306", "Charkhi Dadri", "Haryana"],
  ["121001", "Faridabad", "Haryana"],
  ["125050", "Fatehabad", "Haryana"],
  ["122001", "Gurugram", "Haryana"],
  ["125001", "Hisar", "Haryana"],
  ["124103", "Jhajjar", "Haryana"],
  ["126102", "Jind", "Haryana"],
  ["136027", "Kaithal", "Haryana"],
  ["136118", "Kurukshetra", "Haryana"],
  ["123029", "Mahendragarh", "Haryana"],
  ["122107", "Nuh", "Haryana"],
  ["121102", "Palwal", "Haryana"],
  ["134109", "Panchkula", "Haryana"],
  ["132103", "Panipat", "Haryana"],
  ["123401", "Rewari", "Haryana"],
  ["124001", "Rohtak", "Haryana"],
  ["125055", "Sirsa", "Haryana"],
  ["131001", "Sonipat", "Haryana"],
  ["135001", "Yamunanagar", "Haryana"],
  ["110001", "New Delhi", "Delhi"],
  ["110006", "Central Delhi", "Delhi"],
  ["110031", "East Delhi", "Delhi"],
  ["110007", "North Delhi", "Delhi"],
  ["110032", "Shahdara", "Delhi"],
  ["110017", "South Delhi", "Delhi"],
  ["110024", "South East Delhi", "Delhi"],
  ["110010", "South West Delhi", "Delhi"],
  ["110018", "West Delhi", "Delhi"],
  ["110085", "North West Delhi", "Delhi"],
  ["110093", "North East Delhi", "Delhi"],
  ["160017", "Chandigarh", "Chandigarh"],
  ["141001", "Ludhiana", "Punjab"],
  ["143001", "Amritsar", "Punjab"],
  ["147001", "Patiala", "Punjab"],
  ["144001", "Jalandhar", "Punjab"],
  ["151001", "Bathinda", "Punjab"],
  ["140001", "Rupnagar", "Punjab"],
  ["302001", "Jaipur", "Rajasthan"],
  ["342001", "Jodhpur", "Rajasthan"],
  ["313001", "Udaipur", "Rajasthan"],
  ["334001", "Bikaner", "Rajasthan"],
  ["324001", "Kota", "Rajasthan"],
  ["226001", "Lucknow", "Uttar Pradesh"],
  ["208001", "Kanpur Nagar", "Uttar Pradesh"],
  ["282001", "Agra", "Uttar Pradesh"],
  ["211001", "Prayagraj", "Uttar Pradesh"],
  ["221001", "Varanasi", "Uttar Pradesh"],
  ["201001", "Ghaziabad", "Uttar Pradesh"],
  ["201301", "Gautam Buddha Nagar", "Uttar Pradesh"],
  ["250001", "Meerut", "Uttar Pradesh"],
  ["273001", "Gorakhpur", "Uttar Pradesh"],
  ["411001", "Pune", "Maharashtra"],
  ["400001", "Mumbai City", "Maharashtra"],
  ["400053", "Mumbai Suburban", "Maharashtra"],
  ["440001", "Nagpur", "Maharashtra"],
  ["422001", "Nashik", "Maharashtra"],
  ["431001", "Chhatrapati Sambhajinagar", "Maharashtra"],
  ["416001", "Kolhapur", "Maharashtra"],
  ["380001", "Ahmedabad", "Gujarat"],
  ["395003", "Surat", "Gujarat"],
  ["390001", "Vadodara", "Gujarat"],
  ["360001", "Rajkot", "Gujarat"],
  ["370001", "Kutch", "Gujarat"],
  ["560001", "Bengaluru Urban", "Karnataka"],
  ["570001", "Mysuru", "Karnataka"],
  ["580001", "Dharwad", "Karnataka"],
  ["575001", "Dakshina Kannada", "Karnataka"],
  ["600001", "Chennai", "Tamil Nadu"],
  ["641001", "Coimbatore", "Tamil Nadu"],
  ["625001", "Madurai", "Tamil Nadu"],
  ["620001", "Tiruchirappalli", "Tamil Nadu"],
  ["500001", "Hyderabad", "Telangana"],
  ["505001", "Karimnagar", "Telangana"],
  ["507001", "Khammam", "Telangana"],
  ["506001", "Warangal", "Telangana"],
  ["682001", "Ernakulam", "Kerala"],
  ["695001", "Thiruvananthapuram", "Kerala"],
  ["673001", "Kozhikode", "Kerala"],
  ["680001", "Thrissur", "Kerala"],
  ["452001", "Indore", "Madhya Pradesh"],
  ["462001", "Bhopal", "Madhya Pradesh"],
  ["482001", "Jabalpur", "Madhya Pradesh"],
  ["474001", "Gwalior", "Madhya Pradesh"],
  ["492001", "Raipur", "Chhattisgarh"],
  ["495001", "Bilaspur", "Chhattisgarh"],
  ["800001", "Patna", "Bihar"],
  ["842001", "Muzaffarpur", "Bihar"],
  ["823001", "Gaya", "Bihar"],
  ["700001", "Kolkata", "West Bengal"],
  ["711101", "Howrah", "West Bengal"],
  ["713101", "Paschim Bardhaman", "West Bengal"],
  ["734001", "Darjeeling", "West Bengal"],
  ["751001", "Khordha", "Odisha"],
  ["753001", "Cuttack", "Odisha"],
  ["769001", "Sundargarh", "Odisha"],
  ["834001", "Ranchi", "Jharkhand"],
  ["826001", "Dhanbad", "Jharkhand"],
  ["831001", "East Singhbhum", "Jharkhand"],
  ["781001", "Kamrup Metropolitan", "Assam"],
  ["786001", "Dibrugarh", "Assam"],
  ["248001", "Dehradun", "Uttarakhand"],
  ["249401", "Haridwar", "Uttarakhand"],
  ["263001", "Nainital", "Uttarakhand"],
  ["171001", "Shimla", "Himachal Pradesh"],
  ["176001", "Kangra", "Himachal Pradesh"],
  ["180001", "Jammu", "Jammu and Kashmir"],
  ["190001", "Srinagar", "Jammu and Kashmir"],
  ["194101", "Leh", "Ladakh"],
  ["403001", "North Goa", "Goa"],
  ["403601", "South Goa", "Goa"],
  ["530001", "Visakhapatnam", "Andhra Pradesh"],
  ["520001", "NTR", "Andhra Pradesh"],
  ["522001", "Guntur", "Andhra Pradesh"],
  ["795001", "Imphal West", "Manipur"],
  ["793001", "East Khasi Hills", "Meghalaya"],
  ["796001", "Aizawl", "Mizoram"],
  ["797001", "Kohima", "Nagaland"],
  ["799001", "West Tripura", "Tripura"],
  ["737101", "Gangtok", "Sikkim"],
  ["791111", "Papum Pare", "Arunachal Pradesh"],
  ["744101", "South Andaman", "Andaman and Nicobar Islands"],
  ["605001", "Puducherry", "Puducherry"],
  ["682555", "Lakshadweep", "Lakshadweep"],
  ["396210", "Daman", "Dadra and Nagar Haveli and Daman and Diu"],
  ["362520", "Diu", "Dadra and Nagar Haveli and Daman and Diu"],
  ["396230", "Dadra and Nagar Haveli", "Dadra and Nagar Haveli and Daman and Diu"],
];

export const CAPACITIES = ["0.5 HP", "1 HP", "1.5 HP", "2 HP", "3 HP", "5 HP", "7.5 HP", "10 HP"];

export function parsePincodeCsv(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    const [code, district, state] = line.split(",").map((part) => part.trim().replace(/^"|"$/g, ""));
    if (!/^\d{6}$/.test(code ?? "")) continue;
    if (!district || !state) continue;
    if (/^pincode$/i.test(code)) continue;
    rows.push({ code, district, state });
  }
  return rows;
}
