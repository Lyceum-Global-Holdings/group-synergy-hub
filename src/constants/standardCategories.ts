export interface StandardCategory {
  name: string;
  code: string;
  description?: string;
  subcategories?: StandardCategory[];
}

export interface IndustryTemplate {
  name: string;
  description: string;
  categories: StandardCategory[];
}

export const STANDARD_INDUSTRY_TEMPLATES: IndustryTemplate[] = [
  {
    name: "Apparel",
    description: "Categories for clothing, accessories, and textile businesses",
    categories: [
      {
        name: "Clothing",
        code: "CLO",
        description: "All types of clothing and garments",
        subcategories: [
          {
            name: "Men's Apparel",
            code: "CLO-MEN",
            description: "Men's clothing items",
            subcategories: [
              { name: "Shirts", code: "CLO-MEN-SHT", description: "Dress shirts, casual shirts, t-shirts" },
              { name: "Pants", code: "CLO-MEN-PNT", description: "Trousers, jeans, shorts" },
              { name: "Suits", code: "CLO-MEN-SUT", description: "Business suits, formal wear" },
              { name: "Underwear", code: "CLO-MEN-UND", description: "Undergarments, socks" },
              { name: "Outerwear", code: "CLO-MEN-OUT", description: "Jackets, coats, sweaters" }
            ]
          },
          {
            name: "Women's Apparel",
            code: "CLO-WOM",
            description: "Women's clothing items",
            subcategories: [
              { name: "Dresses", code: "CLO-WOM-DRS", description: "Casual and formal dresses" },
              { name: "Blouses", code: "CLO-WOM-BLS", description: "Shirts, tops, blouses" },
              { name: "Skirts", code: "CLO-WOM-SKT", description: "All types of skirts" },
              { name: "Lingerie", code: "CLO-WOM-LIN", description: "Undergarments, bras, panties" },
              { name: "Outerwear", code: "CLO-WOM-OUT", description: "Jackets, coats, cardigans" }
            ]
          },
          {
            name: "Children's Apparel",
            code: "CLO-KID",
            description: "Children's clothing",
            subcategories: [
              { name: "Boys", code: "CLO-KID-BOY", description: "Boys' clothing" },
              { name: "Girls", code: "CLO-KID-GRL", description: "Girls' clothing" },
              { name: "Infant", code: "CLO-KID-INF", description: "Baby clothing 0-12 months" },
              { name: "Toddler", code: "CLO-KID-TOD", description: "Toddler clothing 1-4 years" }
            ]
          }
        ]
      },
      {
        name: "Footwear",
        code: "FOO",
        description: "All types of shoes and footwear",
        subcategories: [
          { name: "Casual Shoes", code: "FOO-CAS", description: "Everyday casual footwear" },
          { name: "Formal Shoes", code: "FOO-FOR", description: "Business and formal shoes" },
          { name: "Sports Shoes", code: "FOO-SPT", description: "Athletic and sports footwear" },
          { name: "Boots", code: "FOO-BOO", description: "All types of boots" },
          { name: "Sandals", code: "FOO-SAN", description: "Open-toe footwear" }
        ]
      },
      {
        name: "Accessories",
        code: "ACC",
        description: "Fashion accessories and personal items",
        subcategories: [
          {
            name: "Bags & Luggage",
            code: "ACC-BAG",
            description: "All types of bags and luggage",
            subcategories: [
              { name: "Handbags", code: "ACC-BAG-HND", description: "Purses, clutches, totes" },
              { name: "Backpacks", code: "ACC-BAG-BCK", description: "School and travel backpacks" },
              { name: "Wallets", code: "ACC-BAG-WLT", description: "Wallets and card holders" },
              { name: "Luggage", code: "ACC-BAG-LUG", description: "Travel luggage and cases" }
            ]
          },
          {
            name: "Jewelry",
            code: "ACC-JWL",
            description: "All types of jewelry",
            subcategories: [
              { name: "Rings", code: "ACC-JWL-RNG", description: "All types of rings" },
              { name: "Necklaces", code: "ACC-JWL-NCK", description: "Chains, pendants, necklaces" },
              { name: "Earrings", code: "ACC-JWL-EAR", description: "All types of earrings" },
              { name: "Bracelets", code: "ACC-JWL-BRC", description: "Bracelets and bangles" },
              { name: "Watches", code: "ACC-JWL-WTC", description: "All types of watches" }
            ]
          }
        ]
      },
      {
        name: "Textiles & Materials",
        code: "TXT",
        description: "Raw materials and supplies",
        subcategories: [
          {
            name: "Fabrics",
            code: "TXT-FAB",
            description: "Raw fabric materials",
            subcategories: [
              { name: "Cotton", code: "TXT-FAB-COT", description: "Cotton fabrics" },
              { name: "Polyester", code: "TXT-FAB-POL", description: "Polyester fabrics" },
              { name: "Silk", code: "TXT-FAB-SLK", description: "Silk fabrics" },
              { name: "Wool", code: "TXT-FAB-WOL", description: "Wool fabrics" },
              { name: "Denim", code: "TXT-FAB-DEN", description: "Denim fabrics" }
            ]
          },
          {
            name: "Trims & Notions",
            code: "TXT-TRM",
            description: "Sewing supplies and notions",
            subcategories: [
              { name: "Buttons", code: "TXT-TRM-BTN", description: "All types of buttons" },
              { name: "Zippers", code: "TXT-TRM-ZIP", description: "Zippers and fasteners" },
              { name: "Thread", code: "TXT-TRM-THR", description: "Sewing thread" },
              { name: "Elastic", code: "TXT-TRM-ELS", description: "Elastic materials" },
              { name: "Labels", code: "TXT-TRM-LBL", description: "Care labels, brand labels" }
            ]
          }
        ]
      }
    ]
  },
  {
    name: "Construction",
    description: "Categories for construction materials, tools, and equipment",
    categories: [
      {
        name: "Building Materials",
        code: "BLD",
        description: "Core construction materials",
        subcategories: [
          {
            name: "Concrete & Masonry",
            code: "BLD-CON",
            description: "Concrete and masonry products",
            subcategories: [
              { name: "Cement", code: "BLD-CON-CEM", description: "Portland cement, specialty cements" },
              { name: "Concrete Blocks", code: "BLD-CON-BLK", description: "CMU blocks, concrete blocks" },
              { name: "Bricks", code: "BLD-CON-BRK", description: "Clay bricks, concrete bricks" },
              { name: "Mortar", code: "BLD-CON-MOR", description: "Mortar mix, grout" }
            ]
          },
          {
            name: "Steel & Metal",
            code: "BLD-STL",
            description: "Metal construction materials",
            subcategories: [
              { name: "Rebar", code: "BLD-STL-RBR", description: "Reinforcing steel bars" },
              { name: "Structural Steel", code: "BLD-STL-STR", description: "I-beams, angles, channels" },
              { name: "Roofing Metal", code: "BLD-STL-ROF", description: "Metal roofing materials" },
              { name: "Fasteners", code: "BLD-STL-FST", description: "Bolts, screws, nails" }
            ]
          },
          {
            name: "Lumber & Wood",
            code: "BLD-LUM",
            description: "Wood construction materials",
            subcategories: [
              { name: "Framing Lumber", code: "BLD-LUM-FRM", description: "2x4, 2x6, 2x8 lumber" },
              { name: "Plywood", code: "BLD-LUM-PLY", description: "Construction plywood sheets" },
              { name: "Engineered Wood", code: "BLD-LUM-ENG", description: "OSB, LVL, glulam" },
              { name: "Trim", code: "BLD-LUM-TRM", description: "Molding, trim, millwork" }
            ]
          }
        ]
      },
      {
        name: "Electrical & Plumbing",
        code: "ELE",
        description: "Electrical and plumbing systems",
        subcategories: [
          {
            name: "Electrical Supplies",
            code: "ELE-ELC",
            description: "Electrical components",
            subcategories: [
              { name: "Wire", code: "ELE-ELC-WIR", description: "Electrical wire and cable" },
              { name: "Conduit", code: "ELE-ELC-CON", description: "Electrical conduit systems" },
              { name: "Outlets", code: "ELE-ELC-OUT", description: "Electrical outlets and receptacles" },
              { name: "Switches", code: "ELE-ELC-SWT", description: "Light switches and controls" },
              { name: "Panels", code: "ELE-ELC-PNL", description: "Electrical panels and breakers" }
            ]
          },
          {
            name: "Plumbing Supplies",
            code: "ELE-PLM",
            description: "Plumbing components",
            subcategories: [
              { name: "Pipes", code: "ELE-PLM-PIP", description: "Water supply and drain pipes" },
              { name: "Fittings", code: "ELE-PLM-FIT", description: "Pipe fittings and connectors" },
              { name: "Valves", code: "ELE-PLM-VLV", description: "Water valves and controls" },
              { name: "Fixtures", code: "ELE-PLM-FIX", description: "Sinks, toilets, faucets" }
            ]
          }
        ]
      },
      {
        name: "Tools & Equipment",
        code: "TOO",
        description: "Construction tools and equipment",
        subcategories: [
          {
            name: "Hand Tools",
            code: "TOO-HND",
            description: "Manual construction tools",
            subcategories: [
              { name: "Hammers", code: "TOO-HND-HAM", description: "All types of hammers" },
              { name: "Screwdrivers", code: "TOO-HND-SCR", description: "Manual screwdrivers" },
              { name: "Levels", code: "TOO-HND-LVL", description: "Spirit levels, laser levels" },
              { name: "Measuring Tools", code: "TOO-HND-MSR", description: "Tape measures, rulers" }
            ]
          },
          {
            name: "Power Tools",
            code: "TOO-PWR",
            description: "Electric and pneumatic tools",
            subcategories: [
              { name: "Drills", code: "TOO-PWR-DRL", description: "Electric drills and drivers" },
              { name: "Saws", code: "TOO-PWR-SAW", description: "Circular saws, jigsaws" },
              { name: "Grinders", code: "TOO-PWR-GRN", description: "Angle grinders, bench grinders" }
            ]
          }
        ]
      },
      {
        name: "Safety & PPE",
        code: "SAF",
        description: "Safety equipment and personal protective equipment",
        subcategories: [
          {
            name: "Personal Protective Equipment",
            code: "SAF-PPE",
            description: "Worker protection equipment",
            subcategories: [
              { name: "Hard Hats", code: "SAF-PPE-HAT", description: "Safety helmets and hard hats" },
              { name: "Safety Glasses", code: "SAF-PPE-GLS", description: "Eye protection" },
              { name: "Gloves", code: "SAF-PPE-GLV", description: "Work gloves and safety gloves" },
              { name: "Safety Vests", code: "SAF-PPE-VST", description: "High-visibility vests" }
            ]
          }
        ]
      }
    ]
  },
  {
    name: "Stationery",
    description: "Categories for office supplies, writing materials, and educational items",
    categories: [
      {
        name: "Writing Instruments",
        code: "WRI",
        description: "All types of writing tools",
        subcategories: [
          {
            name: "Pens",
            code: "WRI-PEN",
            description: "All types of pens",
            subcategories: [
              { name: "Ballpoint", code: "WRI-PEN-BAL", description: "Ballpoint pens" },
              { name: "Gel", code: "WRI-PEN-GEL", description: "Gel ink pens" },
              { name: "Fountain", code: "WRI-PEN-FOU", description: "Fountain pens" },
              { name: "Markers", code: "WRI-PEN-MAR", description: "Markers and highlighters" }
            ]
          },
          {
            name: "Pencils",
            code: "WRI-PNC",
            description: "All types of pencils",
            subcategories: [
              { name: "Graphite", code: "WRI-PNC-GRA", description: "Standard graphite pencils" },
              { name: "Colored", code: "WRI-PNC-COL", description: "Colored pencils" },
              { name: "Mechanical", code: "WRI-PNC-MEC", description: "Mechanical pencils" }
            ]
          },
          {
            name: "Writing Accessories",
            code: "WRI-ACC",
            description: "Writing accessories",
            subcategories: [
              { name: "Erasers", code: "WRI-ACC-ERA", description: "All types of erasers" },
              { name: "Sharpeners", code: "WRI-ACC-SHP", description: "Pencil sharpeners" },
              { name: "Refills", code: "WRI-ACC-REF", description: "Pen and pencil refills" }
            ]
          }
        ]
      },
      {
        name: "Paper Products",
        code: "PAP",
        description: "All types of paper and paper products",
        subcategories: [
          {
            name: "Office Paper",
            code: "PAP-OFF",
            description: "Business and office paper",
            subcategories: [
              { name: "Copy Paper", code: "PAP-OFF-CPY", description: "Standard copy and printer paper" },
              { name: "Letterhead", code: "PAP-OFF-LTR", description: "Company letterhead paper" },
              { name: "Envelopes", code: "PAP-OFF-ENV", description: "Business envelopes" },
              { name: "Labels", code: "PAP-OFF-LBL", description: "Address and shipping labels" }
            ]
          },
          {
            name: "Notebooks & Journals",
            code: "PAP-NOT",
            description: "Writing pads and notebooks",
            subcategories: [
              { name: "Spiral Notebooks", code: "PAP-NOT-SPI", description: "Spiral-bound notebooks" },
              { name: "Composition Books", code: "PAP-NOT-COM", description: "Composition notebooks" },
              { name: "Legal Pads", code: "PAP-NOT-LEG", description: "Yellow legal pads" },
              { name: "Planners", code: "PAP-NOT-PLN", description: "Calendars and planners" }
            ]
          },
          {
            name: "Specialty Paper",
            code: "PAP-SPC",
            description: "Specialty and craft paper",
            subcategories: [
              { name: "Card Stock", code: "PAP-SPC-CRD", description: "Heavy card stock paper" },
              { name: "Photo Paper", code: "PAP-SPC-PHO", description: "Photo printing paper" },
              { name: "Craft Paper", code: "PAP-SPC-CRF", description: "Construction and craft paper" }
            ]
          }
        ]
      },
      {
        name: "Office Supplies",
        code: "OFF",
        description: "General office supplies and equipment",
        subcategories: [
          {
            name: "Filing & Organization",
            code: "OFF-FIL",
            description: "Organization and filing supplies",
            subcategories: [
              { name: "Folders", code: "OFF-FIL-FOL", description: "File folders and dividers" },
              { name: "Binders", code: "OFF-FIL-BIN", description: "Ring binders and portfolios" },
              { name: "Storage Boxes", code: "OFF-FIL-BOX", description: "Document storage boxes" }
            ]
          },
          {
            name: "Desk Accessories",
            code: "OFF-DSK",
            description: "Desktop organization and tools",
            subcategories: [
              { name: "Staplers", code: "OFF-DSK-STP", description: "Staplers and staples" },
              { name: "Paper Clips", code: "OFF-DSK-CLP", description: "Paper clips and fasteners" },
              { name: "Tape", code: "OFF-DSK-TAP", description: "Adhesive tape and dispensers" },
              { name: "Calculators", code: "OFF-DSK-CAL", description: "Desktop calculators" }
            ]
          }
        ]
      },
      {
        name: "Art & Craft Supplies",
        code: "ART",
        description: "Art, craft, and educational supplies",
        subcategories: [
          {
            name: "Drawing Materials",
            code: "ART-DRW",
            description: "Drawing and sketching supplies",
            subcategories: [
              { name: "Sketch Pads", code: "ART-DRW-SKT", description: "Drawing pads and sketch books" },
              { name: "Charcoal", code: "ART-DRW-CHR", description: "Charcoal sticks and pencils" },
              { name: "Pastels", code: "ART-DRW-PAS", description: "Oil and chalk pastels" }
            ]
          },
          {
            name: "Craft Materials",
            code: "ART-CRF",
            description: "General craft supplies",
            subcategories: [
              { name: "Glue", code: "ART-CRF-GLU", description: "Craft glue and adhesives" },
              { name: "Scissors", code: "ART-CRF-SCI", description: "Craft and safety scissors" },
              { name: "Ribbon", code: "ART-CRF-RIB", description: "Decorative ribbons and tape" }
            ]
          }
        ]
      }
    ]
  }
];