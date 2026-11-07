export type Pathway = {
  id: string;
  title: string;
  category: string;
  description: string;
  minimumGpa: number;
  groups: string[];
  color: string;
};

export type Deadline = {
  id: string;
  institution: string;
  label: string;
  date: string;
  daysLeft: number;
  type: "University" | "Scholarship" | "Technical";
};

export const pathways: Pathway[] = [
  {
    id: "engineering",
    title: "Engineering & Technology",
    category: "Undergraduate",
    description: "Explore engineering universities, technology programs and computing pathways.",
    minimumGpa: 4.5,
    groups: ["Science"],
    color: "from-cyan-400 to-blue-500"
  },
  {
    id: "medical",
    title: "Medical & Health Sciences",
    category: "Undergraduate",
    description: "Compare medical, dental, nursing and allied health education routes.",
    minimumGpa: 4.75,
    groups: ["Science"],
    color: "from-rose-400 to-orange-400"
  },
  {
    id: "business",
    title: "Business & Management",
    category: "Higher education",
    description: "Discover business, finance, marketing and entrepreneurship programs.",
    minimumGpa: 3,
    groups: ["Science", "Business Studies", "Humanities"],
    color: "from-violet-400 to-purple-500"
  },
  {
    id: "technical",
    title: "Diploma & Technical Skills",
    category: "Post-SSC",
    description: "Find polytechnic, diploma and job-ready technical education options.",
    minimumGpa: 2.5,
    groups: ["Science", "Business Studies", "Humanities", "Vocational"],
    color: "from-emerald-400 to-teal-500"
  },
  {
    id: "general",
    title: "General & Multidisciplinary Studies",
    category: "Higher education",
    description: "Explore humanities, social science and multidisciplinary degree routes.",
    minimumGpa: 2,
    groups: ["Science", "Business Studies", "Humanities"],
    color: "from-amber-400 to-orange-500"
  },
  {
    id: "higher-study",
    title: "Higher Study & Research",
    category: "Higher education",
    description: "Find verified postgraduate, research and scholarship pathways after diploma or degree study.",
    minimumGpa: 2.5,
    groups: ["Science", "Business Studies", "Humanities", "Vocational"],
    color: "from-indigo-400 to-violet-500"
  }
];

export const deadlines: Deadline[] = [
  {
    id: "d1",
    institution: "Public University Cluster",
    label: "Online application closes",
    date: "18 Sep 2026",
    daysLeft: 7,
    type: "University"
  },
  {
    id: "d2",
    institution: "National Merit Scholarship",
    label: "Document submission",
    date: "23 Sep 2026",
    daysLeft: 12,
    type: "Scholarship"
  },
  {
    id: "d3",
    institution: "Technical Education Board",
    label: "Choice list confirmation",
    date: "30 Sep 2026",
    daysLeft: 19,
    type: "Technical"
  }
];

export const institutions = [
  { name: "University of Dhaka", location: "Dhaka", type: "Public", programs: 84, match: 92 },
  { name: "BUET", location: "Dhaka", type: "Engineering", programs: 18, match: 89 },
  { name: "University of Chittagong", location: "Chattogram", type: "Public", programs: 73, match: 86 },
  { name: "Dhaka Polytechnic Institute", location: "Dhaka", type: "Technical", programs: 12, match: 82 }
];
