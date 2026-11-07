export type DistrictSeed = { code: string; slug: string; name: string; nameBn: string };
export type DivisionSeed = { code: string; slug: string; name: string; nameBn: string; districts: DistrictSeed[] };

const district = (code: string, slug: string, name: string, nameBn: string): DistrictSeed => ({ code, slug, name, nameBn });

/**
 * Canonical 8-division / 64-district hierarchy used as the stable location
 * vocabulary. Upazilas are imported from a dated government source because
 * their names and boundaries can change independently of an app release.
 */
export const bangladeshDivisions: DivisionSeed[] = [
  {
    code: "BD-C", slug: "dhaka", name: "Dhaka", nameBn: "ঢাকা", districts: [
      district("BD-DHA", "dhaka", "Dhaka", "ঢাকা"),
      district("BD-FAR", "faridpur", "Faridpur", "ফরিদপুর"),
      district("BD-GAZ", "gazipur", "Gazipur", "গাজীপুর"),
      district("BD-GOP", "gopalganj", "Gopalganj", "গোপালগঞ্জ"),
      district("BD-KIS", "kishoreganj", "Kishoreganj", "কিশোরগঞ্জ"),
      district("BD-MAD", "madaripur", "Madaripur", "মাদারীপুর"),
      district("BD-MAN", "manikganj", "Manikganj", "মানিকগঞ্জ"),
      district("BD-MUN", "munshiganj", "Munshiganj", "মুন্সিগঞ্জ"),
      district("BD-NAR", "narayanganj", "Narayanganj", "নারায়ণগঞ্জ"),
      district("BD-NRS", "narsingdi", "Narsingdi", "নরসিংদী"),
      district("BD-RAJ", "rajbari", "Rajbari", "রাজবাড়ী"),
      district("BD-SHA", "shariatpur", "Shariatpur", "শরীয়তপুর"),
      district("BD-TAN", "tangail", "Tangail", "টাঙ্গাইল")
    ]
  },
  {
    code: "BD-B", slug: "chattogram", name: "Chattogram", nameBn: "চট্টগ্রাম", districts: [
      district("BD-BAN", "bandarban", "Bandarban", "বান্দরবান"),
      district("BD-BRA", "brahmanbaria", "Brahmanbaria", "ব্রাহ্মণবাড়িয়া"),
      district("BD-CHA", "chandpur", "Chandpur", "চাঁদপুর"),
      district("BD-CTG", "chattogram", "Chattogram", "চট্টগ্রাম"),
      district("BD-COX", "coxs-bazar", "Cox's Bazar", "কক্সবাজার"),
      district("BD-COM", "cumilla", "Cumilla", "কুমিল্লা"),
      district("BD-FEN", "feni", "Feni", "ফেনী"),
      district("BD-KHA", "khagrachhari", "Khagrachhari", "খাগড়াছড়ি"),
      district("BD-LAK", "lakshmipur", "Lakshmipur", "লক্ষ্মীপুর"),
      district("BD-NOA", "noakhali", "Noakhali", "নোয়াখালী"),
      district("BD-RAN", "rangamati", "Rangamati", "রাঙ্গামাটি")
    ]
  },
  {
    code: "BD-E", slug: "rajshahi", name: "Rajshahi", nameBn: "রাজশাহী", districts: [
      district("BD-BOG", "bogura", "Bogura", "বগুড়া"),
      district("BD-JOY", "joypurhat", "Joypurhat", "জয়পুরহাট"),
      district("BD-NAO", "naogaon", "Naogaon", "নওগাঁ"),
      district("BD-NAT", "natore", "Natore", "নাটোর"),
      district("BD-CHP", "chapainawabganj", "Chapainawabganj", "চাঁপাইনবাবগঞ্জ"),
      district("BD-PAB", "pabna", "Pabna", "পাবনা"),
      district("BD-RJS", "rajshahi", "Rajshahi", "রাজশাহী"),
      district("BD-SIR", "sirajganj", "Sirajganj", "সিরাজগঞ্জ")
    ]
  },
  {
    code: "BD-D", slug: "khulna", name: "Khulna", nameBn: "খুলনা", districts: [
      district("BD-BAG", "bagerhat", "Bagerhat", "বাগেরহাট"),
      district("BD-CHU", "chuadanga", "Chuadanga", "চুয়াডাঙ্গা"),
      district("BD-JAS", "jashore", "Jashore", "যশোর"),
      district("BD-JHE", "jhenaidah", "Jhenaidah", "ঝিনাইদহ"),
      district("BD-KHU", "khulna", "Khulna", "খুলনা"),
      district("BD-KUS", "kushtia", "Kushtia", "কুষ্টিয়া"),
      district("BD-MAG", "magura", "Magura", "মাগুরা"),
      district("BD-MEH", "meherpur", "Meherpur", "মেহেরপুর"),
      district("BD-NARL", "narail", "Narail", "নড়াইল"),
      district("BD-SAT", "satkhira", "Satkhira", "সাতক্ষীরা")
    ]
  },
  {
    code: "BD-A", slug: "barishal", name: "Barishal", nameBn: "বরিশাল", districts: [
      district("BD-BAR", "barguna", "Barguna", "বরগুনা"),
      district("BD-BSL", "barishal", "Barishal", "বরিশাল"),
      district("BD-BHO", "bhola", "Bhola", "ভোলা"),
      district("BD-JHA", "jhalakathi", "Jhalakathi", "ঝালকাঠি"),
      district("BD-PAT", "patuakhali", "Patuakhali", "পটুয়াখালী"),
      district("BD-PIR", "pirojpur", "Pirojpur", "পিরোজপুর")
    ]
  },
  {
    code: "BD-G", slug: "sylhet", name: "Sylhet", nameBn: "সিলেট", districts: [
      district("BD-HAB", "habiganj", "Habiganj", "হবিগঞ্জ"),
      district("BD-MOU", "moulvibazar", "Moulvibazar", "মৌলভীবাজার"),
      district("BD-SUN", "sunamganj", "Sunamganj", "সুনামগঞ্জ"),
      district("BD-SYL", "sylhet", "Sylhet", "সিলেট")
    ]
  },
  {
    code: "BD-F", slug: "rangpur", name: "Rangpur", nameBn: "রংপুর", districts: [
      district("BD-DIN", "dinajpur", "Dinajpur", "দিনাজপুর"),
      district("BD-GAI", "gaibandha", "Gaibandha", "গাইবান্ধা"),
      district("BD-KUR", "kurigram", "Kurigram", "কুড়িগ্রাম"),
      district("BD-LAL", "lalmonirhat", "Lalmonirhat", "লালমনিরহাট"),
      district("BD-NIL", "nilphamari", "Nilphamari", "নীলফামারী"),
      district("BD-PAN", "panchagarh", "Panchagarh", "পঞ্চগড়"),
      district("BD-RNG", "rangpur", "Rangpur", "রংপুর"),
      district("BD-THA", "thakurgaon", "Thakurgaon", "ঠাকুরগাঁও")
    ]
  },
  {
    code: "BD-H", slug: "mymensingh", name: "Mymensingh", nameBn: "ময়মনসিংহ", districts: [
      district("BD-JAM", "jamalpur", "Jamalpur", "জামালপুর"),
      district("BD-MYM", "mymensingh", "Mymensingh", "ময়মনসিংহ"),
      district("BD-NET", "netrokona", "Netrokona", "নেত্রকোনা"),
      district("BD-SHE", "sherpur", "Sherpur", "শেরপুর")
    ]
  }
];

export const districtCount = bangladeshDivisions.reduce((total, division) => total + division.districts.length, 0);

if (bangladeshDivisions.length !== 8 || districtCount !== 64) {
  throw new Error("Bangladesh location seed must contain exactly 8 divisions and 64 districts.");
}
