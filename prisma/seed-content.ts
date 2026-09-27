// Course catalogue used by the seed: 8 domains × 4 modules × 3 chapters.
// Each chapter has a one-line summary that also drives generated quiz questions.

export interface ChapterSeed {
  name: string;
  summary: string;
}
export interface ModuleSeed {
  name: string;
  chapters: ChapterSeed[];
}
export interface DomainSeed {
  code: string;
  name: string;
  sector: string;
  fee: number; // rupees
  featured: boolean;
  description: string;
  modules: ModuleSeed[];
}

export const DOMAINS: DomainSeed[] = [
  {
    code: "WEB",
    name: "Web Development",
    sector: "Information Technology",
    fee: 1999,
    featured: true,
    description: "Build responsive, accessible websites and web apps with HTML, CSS, JavaScript and React, and deploy a live project.",
    modules: [
      {
        name: "Foundations of the Web",
        chapters: [
          { name: "How the Web Works", summary: "Browsers request resources from servers over HTTP and render HTML, CSS and JavaScript" },
          { name: "Semantic HTML", summary: "Using meaningful elements like header, nav, main and article for structure and accessibility" },
          { name: "CSS Layout with Flexbox and Grid", summary: "Arranging page elements in one or two dimensions using flexbox and CSS grid" },
        ],
      },
      {
        name: "JavaScript Essentials",
        chapters: [
          { name: "Variables, Types and Functions", summary: "Declaring values with let and const and packaging logic into reusable functions" },
          { name: "The DOM and Events", summary: "Selecting page elements and reacting to user actions with event listeners" },
          { name: "Asynchronous JavaScript", summary: "Working with promises, async/await and fetch to call web APIs" },
        ],
      },
      {
        name: "Modern Front-end with React",
        chapters: [
          { name: "Components and Props", summary: "Composing user interfaces from reusable components configured with props" },
          { name: "State and Hooks", summary: "Managing changing data inside components with useState and useEffect" },
          { name: "Routing and Forms", summary: "Navigating between pages and handling controlled form inputs" },
        ],
      },
      {
        name: "Shipping a Live Project",
        chapters: [
          { name: "Version Control with Git", summary: "Tracking changes, branching and collaborating through commits and pull requests" },
          { name: "Deploying to the Cloud", summary: "Publishing a production build to a hosting platform with a custom domain" },
          { name: "Performance and Accessibility", summary: "Measuring page speed and making interfaces usable for everyone" },
        ],
      },
    ],
  },
  {
    code: "AIML",
    name: "Artificial Intelligence & Machine Learning",
    sector: "Information Technology",
    fee: 2499,
    featured: true,
    description: "Learn Python for data, core machine learning algorithms, model evaluation and responsible AI through hands-on notebooks.",
    modules: [
      {
        name: "Python for AI",
        chapters: [
          { name: "Python Refresher", summary: "Core Python syntax, lists, dictionaries and functions used in data work" },
          { name: "NumPy and Pandas", summary: "Manipulating arrays and tabular data frames efficiently" },
          { name: "Visualising Data", summary: "Plotting distributions and relationships with Matplotlib and Seaborn" },
        ],
      },
      {
        name: "Supervised Learning",
        chapters: [
          { name: "Linear and Logistic Regression", summary: "Predicting numbers and classes by fitting weighted combinations of features" },
          { name: "Decision Trees and Random Forests", summary: "Splitting data on feature thresholds and averaging many trees" },
          { name: "Model Evaluation", summary: "Measuring accuracy, precision, recall and avoiding overfitting with validation" },
        ],
      },
      {
        name: "Unsupervised and Deep Learning",
        chapters: [
          { name: "Clustering with K-Means", summary: "Grouping unlabeled data points around learned centroids" },
          { name: "Neural Network Basics", summary: "Layers of weighted neurons trained with backpropagation and gradient descent" },
          { name: "Intro to Computer Vision", summary: "Using convolutional networks to classify images" },
        ],
      },
      {
        name: "Applied and Responsible AI",
        chapters: [
          { name: "Working with Language Models", summary: "Prompting and evaluating large language models for practical tasks" },
          { name: "Bias, Fairness and Ethics", summary: "Identifying harmful bias and designing accountable AI systems" },
          { name: "Deploying an ML Model", summary: "Serving a trained model behind an API and monitoring it" },
        ],
      },
    ],
  },
  {
    code: "DA",
    name: "Data Analytics",
    sector: "Information Technology",
    fee: 1799,
    featured: true,
    description: "Turn raw data into decisions with Excel, SQL, Power BI dashboards and statistical storytelling.",
    modules: [
      {
        name: "Spreadsheet Analytics",
        chapters: [
          { name: "Cleaning Data in Excel", summary: "Removing duplicates, fixing formats and handling missing values" },
          { name: "Formulas and Lookups", summary: "Using SUMIFS, XLOOKUP and logical functions to combine data" },
          { name: "Pivot Tables", summary: "Summarising large datasets by grouping and aggregating fields" },
        ],
      },
      {
        name: "SQL for Analysts",
        chapters: [
          { name: "SELECT and Filtering", summary: "Retrieving rows and columns with WHERE conditions and sorting" },
          { name: "Joins and Aggregations", summary: "Combining tables and computing totals with GROUP BY" },
          { name: "Window Functions", summary: "Calculating running totals and rankings across partitions" },
        ],
      },
      {
        name: "Dashboards and BI",
        chapters: [
          { name: "Designing KPIs", summary: "Choosing measurable indicators aligned to business goals" },
          { name: "Building Power BI Reports", summary: "Modelling data and creating interactive visuals" },
          { name: "Data Storytelling", summary: "Presenting insights with clear narrative and the right chart" },
        ],
      },
      {
        name: "Statistics for Decisions",
        chapters: [
          { name: "Descriptive Statistics", summary: "Mean, median, spread and distribution shape" },
          { name: "Hypothesis Testing", summary: "Using p-values and confidence intervals to test claims" },
          { name: "A/B Testing", summary: "Comparing two variants with a controlled experiment" },
        ],
      },
    ],
  },
  {
    code: "DM",
    name: "Digital Marketing",
    sector: "Business & Management",
    fee: 1499,
    featured: true,
    description: "Plan and run campaigns across search, social and email, and measure results with analytics.",
    modules: [
      {
        name: "Marketing Fundamentals",
        chapters: [
          { name: "The Digital Marketing Funnel", summary: "Moving customers from awareness to consideration, conversion and loyalty" },
          { name: "Buyer Personas", summary: "Describing target customers by needs, behaviour and demographics" },
          { name: "Brand Positioning", summary: "Defining how a brand is different and valuable to its audience" },
        ],
      },
      {
        name: "Search Marketing",
        chapters: [
          { name: "SEO Basics", summary: "Improving organic ranking through keywords, content and technical health" },
          { name: "Google Ads", summary: "Bidding on keywords to show paid search ads" },
          { name: "Keyword Research", summary: "Finding search terms by volume, intent and competition" },
        ],
      },
      {
        name: "Social and Content",
        chapters: [
          { name: "Social Media Strategy", summary: "Choosing platforms, content pillars and posting cadence" },
          { name: "Content Marketing", summary: "Attracting audiences with useful blogs, videos and guides" },
          { name: "Influencer Collaboration", summary: "Partnering with creators to reach engaged communities" },
        ],
      },
      {
        name: "Measurement and Email",
        chapters: [
          { name: "Web Analytics", summary: "Tracking sessions, sources and conversions with analytics tools" },
          { name: "Email Campaigns", summary: "Segmenting lists and automating personalised email journeys" },
          { name: "ROI and Attribution", summary: "Assigning conversions to channels and measuring return on spend" },
        ],
      },
    ],
  },
  {
    code: "BM",
    name: "Business Management",
    sector: "Business & Management",
    fee: 1499,
    featured: true,
    description: "Understand how organisations plan, operate and grow — strategy, operations, finance and entrepreneurship.",
    modules: [
      {
        name: "Principles of Management",
        chapters: [
          { name: "Functions of Management", summary: "Planning, organising, staffing, directing and controlling" },
          { name: "Organisational Structures", summary: "Functional, divisional and matrix ways of arranging teams" },
          { name: "Decision Making", summary: "Rational and bounded approaches to choosing between alternatives" },
        ],
      },
      {
        name: "Strategy",
        chapters: [
          { name: "SWOT Analysis", summary: "Assessing strengths, weaknesses, opportunities and threats" },
          { name: "Porter's Five Forces", summary: "Analysing competitive pressure in an industry" },
          { name: "Business Model Canvas", summary: "Mapping value proposition, customers, channels and costs on one page" },
        ],
      },
      {
        name: "Operations and Finance",
        chapters: [
          { name: "Operations Management", summary: "Designing processes that deliver quality efficiently" },
          { name: "Reading Financial Statements", summary: "Interpreting the balance sheet, income statement and cash flow" },
          { name: "Budgeting and Costing", summary: "Planning spend and understanding fixed and variable costs" },
        ],
      },
      {
        name: "Entrepreneurship",
        chapters: [
          { name: "Idea Validation", summary: "Testing demand with customer interviews and minimum viable products" },
          { name: "Startup Ecosystem in India", summary: "Incubators, Startup India schemes and funding stages" },
          { name: "Pitching a Business", summary: "Communicating problem, solution, market and traction to investors" },
        ],
      },
    ],
  },
  {
    code: "HR",
    name: "Human Resources",
    sector: "Business & Management",
    fee: 1499,
    featured: true,
    description: "Explore the employee lifecycle — recruitment, onboarding, performance, compensation and labour law.",
    modules: [
      {
        name: "HR Foundations",
        chapters: [
          { name: "Role of HR", summary: "How HR aligns people practices with organisational goals" },
          { name: "HR Planning", summary: "Forecasting workforce needs and closing skill gaps" },
          { name: "Job Analysis", summary: "Writing job descriptions and person specifications" },
        ],
      },
      {
        name: "Talent Acquisition",
        chapters: [
          { name: "Sourcing Candidates", summary: "Using job portals, referrals and campus drives" },
          { name: "Interviewing and Selection", summary: "Structured interviews and assessment centres" },
          { name: "Onboarding", summary: "Integrating new hires with orientation and buddy programmes" },
        ],
      },
      {
        name: "Performance and Rewards",
        chapters: [
          { name: "Performance Appraisal", summary: "Setting goals and giving feedback through review cycles" },
          { name: "Compensation and Benefits", summary: "Designing pay structures and statutory benefits" },
          { name: "Learning and Development", summary: "Identifying training needs and measuring impact" },
        ],
      },
      {
        name: "Employee Relations and Law",
        chapters: [
          { name: "Indian Labour Codes", summary: "Key provisions on wages, social security and industrial relations" },
          { name: "Grievance Handling", summary: "Resolving employee complaints fairly and on time" },
          { name: "HR Analytics", summary: "Using attrition and engagement data to guide decisions" },
        ],
      },
    ],
  },
  {
    code: "PM",
    name: "Project Management",
    sector: "Business & Management",
    fee: 1699,
    featured: true,
    description: "Plan, execute and close projects using waterfall and agile methods, with real tools and templates.",
    modules: [
      {
        name: "Project Initiation",
        chapters: [
          { name: "What is a Project?", summary: "A temporary effort with a defined scope, schedule and budget" },
          { name: "Project Charter", summary: "Authorising a project and stating objectives and stakeholders" },
          { name: "Stakeholder Analysis", summary: "Mapping influence and interest of people affected by the project" },
        ],
      },
      {
        name: "Planning",
        chapters: [
          { name: "Work Breakdown Structure", summary: "Decomposing scope into manageable work packages" },
          { name: "Scheduling and Gantt Charts", summary: "Sequencing tasks and finding the critical path" },
          { name: "Risk Management", summary: "Identifying, assessing and responding to project risks" },
        ],
      },
      {
        name: "Agile Delivery",
        chapters: [
          { name: "Scrum Framework", summary: "Sprints, roles and ceremonies for iterative delivery" },
          { name: "Kanban", summary: "Visualising work and limiting work in progress" },
          { name: "User Stories and Backlogs", summary: "Capturing requirements as prioritised user-centred stories" },
        ],
      },
      {
        name: "Monitoring and Closure",
        chapters: [
          { name: "Tracking Progress", summary: "Using status reports and earned value to monitor performance" },
          { name: "Change Control", summary: "Evaluating and approving changes to scope" },
          { name: "Project Closure", summary: "Handing over deliverables and recording lessons learned" },
        ],
      },
    ],
  },
  {
    code: "AGRI",
    name: "Agri-Business Management",
    sector: "Agriculture & Rural Development",
    fee: 1299,
    featured: true,
    description: "Understand farm economics, agri value chains, FPOs, rural marketing and agri-tech for India's growing agri sector.",
    modules: [
      {
        name: "Agriculture Economy",
        chapters: [
          { name: "Indian Agriculture Overview", summary: "Crop seasons, landholding patterns and the sector's share of GDP" },
          { name: "Farm Economics", summary: "Calculating input costs, yields and farm profitability" },
          { name: "Government Schemes", summary: "PM-KISAN, crop insurance and minimum support price" },
        ],
      },
      {
        name: "Agri Value Chains",
        chapters: [
          { name: "Supply Chain and Mandis", summary: "How produce moves from farm gate through APMC markets to consumers" },
          { name: "Post-harvest Management", summary: "Storage, grading and cold chains that reduce losses" },
          { name: "Food Processing", summary: "Adding value through processing and packaging" },
        ],
      },
      {
        name: "Rural Enterprise",
        chapters: [
          { name: "Farmer Producer Organisations", summary: "Collectives that give farmers bargaining power" },
          { name: "Rural Marketing", summary: "Reaching rural consumers with the right product, price and channel" },
          { name: "Agri Credit and Finance", summary: "Kisan credit cards, microfinance and cooperative banks" },
        ],
      },
      {
        name: "Agri-Tech and Sustainability",
        chapters: [
          { name: "Digital Agriculture", summary: "Using apps, sensors and e-NAM for better decisions and access" },
          { name: "Sustainable Farming", summary: "Organic practices, water conservation and soil health" },
          { name: "Agri Startups", summary: "Business models of Indian agri-tech ventures" },
        ],
      },
    ],
  },
];

/** Hand-written question bank for the first Web Development chapters (others are generated). */
export const WEB_QUESTIONS: Record<string, { q: string; options: string[]; correct: number; explanation: string }[]> = {
  "How the Web Works": [
    { q: "Which protocol do browsers use to request web pages?", options: ["FTP", "HTTP/HTTPS", "SMTP", "SSH"], correct: 1, explanation: "Web pages are fetched over HTTP, and HTTPS adds TLS encryption." },
    { q: "What does DNS do?", options: ["Stores website files", "Translates domain names to IP addresses", "Encrypts passwords", "Compresses images"], correct: 1, explanation: "DNS resolves human-readable names like example.com to IP addresses." },
    { q: "Which of these runs in the browser?", options: ["JavaScript", "MySQL", "Nginx", "Linux kernel"], correct: 0, explanation: "Browsers execute JavaScript; the others run on servers." },
    { q: "HTTP status code 404 means…", options: ["Success", "Server error", "Not found", "Redirect"], correct: 2, explanation: "404 indicates the requested resource was not found." },
    { q: "Which part of a URL identifies the server?", options: ["Path", "Query string", "Host/domain", "Fragment"], correct: 2, explanation: "The host (e.g. msycollege.org) identifies the server." },
  ],
  "Semantic HTML": [
    { q: "Which element should wrap the main content of a page?", options: ["<div>", "<main>", "<span>", "<section>"], correct: 1, explanation: "<main> marks the dominant content and helps assistive technology." },
    { q: "Why use semantic HTML?", options: ["Faster CSS", "Better accessibility and SEO", "Smaller images", "It is required by JavaScript"], correct: 1, explanation: "Meaningful elements help screen readers and search engines understand content." },
    { q: "What attribute gives an image a text alternative?", options: ["title", "src", "alt", "href"], correct: 2, explanation: "alt text is read aloud by screen readers and shown if the image fails." },
    { q: "Which element is best for site navigation links?", options: ["<nav>", "<aside>", "<footer>", "<ul> only"], correct: 0, explanation: "<nav> identifies a block of navigation links." },
  ],
};
