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
  },
  {
    name: "Manufacturing",
    description: "Raw materials, chemicals, MRO supplies for manufacturing facilities",
    categories: [
      {
        name: "Raw Materials",
        code: "RAW",
        description: "Primary production inputs",
        subcategories: [
          {
            name: "Metals",
            code: "RAW-MTL",
            description: "Metal raw materials",
            subcategories: [
              { name: "Steel Sheets", code: "RAW-MTL-STL", description: "Steel plates, coils, sheets" },
              { name: "Aluminum", code: "RAW-MTL-ALM", description: "Aluminum bars, sheets, extrusions" },
              { name: "Copper", code: "RAW-MTL-CPR", description: "Copper wire, sheets, tubes" },
              { name: "Brass", code: "RAW-MTL-BRS", description: "Brass fittings, rods, sheets" }
            ]
          },
          {
            name: "Plastics & Polymers",
            code: "RAW-PLS",
            description: "Plastic raw materials",
            subcategories: [
              { name: "Resins", code: "RAW-PLS-RSN", description: "PE, PP, PVC resins and pellets" },
              { name: "Sheets", code: "RAW-PLS-SHT", description: "Acrylic, polycarbonate sheets" },
              { name: "Films", code: "RAW-PLS-FLM", description: "Stretch film, shrink wrap" }
            ]
          },
          {
            name: "Rubber & Elastomers",
            code: "RAW-RBR",
            description: "Rubber materials",
            subcategories: [
              { name: "Natural Rubber", code: "RAW-RBR-NAT", description: "Natural rubber sheets, blocks" },
              { name: "Synthetic Rubber", code: "RAW-RBR-SYN", description: "Neoprene, silicone, EPDM" }
            ]
          }
        ]
      },
      {
        name: "Chemicals",
        code: "CHM",
        description: "Industrial chemicals and compounds",
        subcategories: [
          {
            name: "Solvents",
            code: "CHM-SLV",
            description: "Industrial solvents",
            subcategories: [
              { name: "Alcohols", code: "CHM-SLV-ALC", description: "IPA, ethanol, methanol" },
              { name: "Acetone", code: "CHM-SLV-ACT", description: "Acetone and ketones" },
              { name: "Thinners", code: "CHM-SLV-THN", description: "Paint thinners, mineral spirits" }
            ]
          },
          {
            name: "Adhesives & Sealants",
            code: "CHM-ADH",
            description: "Bonding agents",
            subcategories: [
              { name: "Epoxy", code: "CHM-ADH-EPX", description: "Epoxy adhesives and resins" },
              { name: "Silicone Sealant", code: "CHM-ADH-SLC", description: "Silicone sealants" },
              { name: "Contact Cement", code: "CHM-ADH-CNT", description: "Contact adhesives" }
            ]
          },
          {
            name: "Lubricants",
            code: "CHM-LUB",
            description: "Machine lubricants",
            subcategories: [
              { name: "Machine Oil", code: "CHM-LUB-OIL", description: "Cutting oil, hydraulic oil" },
              { name: "Grease", code: "CHM-LUB-GRS", description: "Bearing grease, lithium grease" },
              { name: "Coolants", code: "CHM-LUB-CLN", description: "Cutting coolants, antifreeze" }
            ]
          }
        ]
      },
      {
        name: "MRO Supplies",
        code: "MRO",
        description: "Maintenance, repair, and operations",
        subcategories: [
          {
            name: "Bearings & Seals",
            code: "MRO-BRG",
            description: "Mechanical components",
            subcategories: [
              { name: "Ball Bearings", code: "MRO-BRG-BAL", description: "Ball and roller bearings" },
              { name: "Seals", code: "MRO-BRG-SEL", description: "O-rings, gaskets, seals" },
              { name: "Belts", code: "MRO-BRG-BLT", description: "V-belts, timing belts" }
            ]
          },
          {
            name: "Electrical Components",
            code: "MRO-ELC",
            description: "Electrical maintenance parts",
            subcategories: [
              { name: "Motors", code: "MRO-ELC-MOT", description: "Electric motors, servo motors" },
              { name: "Switches", code: "MRO-ELC-SWT", description: "Limit switches, relays" },
              { name: "Sensors", code: "MRO-ELC-SNS", description: "Proximity, temperature sensors" }
            ]
          },
          {
            name: "Filters",
            code: "MRO-FLT",
            description: "Filtration products",
            subcategories: [
              { name: "Air Filters", code: "MRO-FLT-AIR", description: "HVAC and compressor filters" },
              { name: "Oil Filters", code: "MRO-FLT-OIL", description: "Hydraulic and engine oil filters" },
              { name: "Water Filters", code: "MRO-FLT-WTR", description: "Water treatment filters" }
            ]
          }
        ]
      },
      {
        name: "Packaging Materials",
        code: "PKG",
        description: "Product packaging supplies",
        subcategories: [
          {
            name: "Boxes & Cartons",
            code: "PKG-BOX",
            description: "Corrugated packaging",
            subcategories: [
              { name: "Corrugated Boxes", code: "PKG-BOX-COR", description: "Standard shipping boxes" },
              { name: "Custom Boxes", code: "PKG-BOX-CST", description: "Branded and custom cartons" }
            ]
          },
          {
            name: "Protective Packaging",
            code: "PKG-PRT",
            description: "Cushioning and protection",
            subcategories: [
              { name: "Bubble Wrap", code: "PKG-PRT-BBL", description: "Bubble wrap rolls" },
              { name: "Foam", code: "PKG-PRT-FOM", description: "Foam sheets, peanuts" },
              { name: "Void Fill", code: "PKG-PRT-VOD", description: "Paper fill, air pillows" }
            ]
          }
        ]
      }
    ]
  },
  {
    name: "IT & Electronics",
    description: "Hardware, networking, peripherals, and electronic components",
    categories: [
      {
        name: "Computer Hardware",
        code: "HRD",
        description: "Computing equipment",
        subcategories: [
          {
            name: "Desktops & Workstations",
            code: "HRD-DSK",
            description: "Desktop computers",
            subcategories: [
              { name: "Towers", code: "HRD-DSK-TWR", description: "Desktop tower PCs" },
              { name: "All-in-One", code: "HRD-DSK-AIO", description: "All-in-one desktops" },
              { name: "Workstations", code: "HRD-DSK-WRK", description: "High-performance workstations" }
            ]
          },
          {
            name: "Laptops & Tablets",
            code: "HRD-LAP",
            description: "Portable computing",
            subcategories: [
              { name: "Laptops", code: "HRD-LAP-LPT", description: "Business and consumer laptops" },
              { name: "Tablets", code: "HRD-LAP-TBL", description: "Tablets and iPads" },
              { name: "Chromebooks", code: "HRD-LAP-CHR", description: "Chromebook devices" }
            ]
          },
          {
            name: "Servers & Storage",
            code: "HRD-SRV",
            description: "Enterprise infrastructure",
            subcategories: [
              { name: "Rack Servers", code: "HRD-SRV-RCK", description: "Rack-mounted servers" },
              { name: "NAS", code: "HRD-SRV-NAS", description: "Network attached storage" },
              { name: "Hard Drives", code: "HRD-SRV-HDD", description: "HDD, SSD, NVMe drives" }
            ]
          }
        ]
      },
      {
        name: "Networking",
        code: "NET",
        description: "Network infrastructure equipment",
        subcategories: [
          {
            name: "Active Equipment",
            code: "NET-ACT",
            description: "Powered network devices",
            subcategories: [
              { name: "Routers", code: "NET-ACT-RTR", description: "Network routers" },
              { name: "Switches", code: "NET-ACT-SWT", description: "Managed and unmanaged switches" },
              { name: "Access Points", code: "NET-ACT-WAP", description: "Wireless access points" },
              { name: "Firewalls", code: "NET-ACT-FWL", description: "Network firewalls, UTMs" }
            ]
          },
          {
            name: "Cabling",
            code: "NET-CBL",
            description: "Network cables and accessories",
            subcategories: [
              { name: "Ethernet", code: "NET-CBL-ETH", description: "Cat5e, Cat6, Cat6a cables" },
              { name: "Fiber Optic", code: "NET-CBL-FBR", description: "Single and multi-mode fiber" },
              { name: "Patch Panels", code: "NET-CBL-PNL", description: "Patch panels and jacks" }
            ]
          }
        ]
      },
      {
        name: "Peripherals",
        code: "PRP",
        description: "Computer peripherals and accessories",
        subcategories: [
          {
            name: "Display & Output",
            code: "PRP-DSP",
            description: "Monitors and display devices",
            subcategories: [
              { name: "Monitors", code: "PRP-DSP-MON", description: "LCD, LED monitors" },
              { name: "Projectors", code: "PRP-DSP-PRJ", description: "Data and video projectors" }
            ]
          },
          {
            name: "Input Devices",
            code: "PRP-INP",
            description: "Keyboards, mice, scanners",
            subcategories: [
              { name: "Keyboards", code: "PRP-INP-KBD", description: "Wired and wireless keyboards" },
              { name: "Mice", code: "PRP-INP-MOU", description: "Wired and wireless mice" },
              { name: "Scanners", code: "PRP-INP-SCN", description: "Flatbed, document scanners" }
            ]
          },
          {
            name: "Printers & Supplies",
            code: "PRP-PRN",
            description: "Printing equipment",
            subcategories: [
              { name: "Printers", code: "PRP-PRN-PRT", description: "Laser, inkjet printers" },
              { name: "Toner & Ink", code: "PRP-PRN-TNR", description: "Toner cartridges, ink" },
              { name: "Print Media", code: "PRP-PRN-MED", description: "Specialty print paper, labels" }
            ]
          }
        ]
      },
      {
        name: "Components",
        code: "CMP",
        description: "Electronic components and parts",
        subcategories: [
          {
            name: "Internal Components",
            code: "CMP-INT",
            description: "Computer internal parts",
            subcategories: [
              { name: "RAM", code: "CMP-INT-RAM", description: "Memory modules" },
              { name: "CPUs", code: "CMP-INT-CPU", description: "Processors" },
              { name: "GPUs", code: "CMP-INT-GPU", description: "Graphics cards" },
              { name: "Power Supplies", code: "CMP-INT-PSU", description: "ATX, server PSUs" }
            ]
          },
          {
            name: "Cables & Adapters",
            code: "CMP-CBL",
            description: "Connection cables",
            subcategories: [
              { name: "USB Cables", code: "CMP-CBL-USB", description: "USB-A, USB-C, micro USB" },
              { name: "HDMI/Display", code: "CMP-CBL-HDM", description: "HDMI, DisplayPort cables" },
              { name: "Power Cables", code: "CMP-CBL-PWR", description: "Power cords, extension cables" }
            ]
          }
        ]
      }
    ]
  },
  {
    name: "Automotive",
    description: "Vehicle parts, fluids, accessories, and maintenance supplies",
    categories: [
      {
        name: "Engine & Drivetrain",
        code: "ENG",
        description: "Engine and transmission parts",
        subcategories: [
          {
            name: "Engine Parts",
            code: "ENG-PRT",
            description: "Internal engine components",
            subcategories: [
              { name: "Filters", code: "ENG-PRT-FLT", description: "Oil, air, fuel filters" },
              { name: "Belts & Hoses", code: "ENG-PRT-BLT", description: "Timing belts, radiator hoses" },
              { name: "Spark Plugs", code: "ENG-PRT-SPK", description: "Ignition components" },
              { name: "Gaskets", code: "ENG-PRT-GSK", description: "Head gaskets, valve seals" }
            ]
          },
          {
            name: "Transmission",
            code: "ENG-TRN",
            description: "Transmission components",
            subcategories: [
              { name: "Clutch Parts", code: "ENG-TRN-CLT", description: "Clutch disc, pressure plate" },
              { name: "Gearbox Parts", code: "ENG-TRN-GBX", description: "Synchros, bearings, shafts" }
            ]
          }
        ]
      },
      {
        name: "Fluids & Lubricants",
        code: "FLD",
        description: "Automotive fluids",
        subcategories: [
          {
            name: "Oils",
            code: "FLD-OIL",
            description: "Engine and transmission oils",
            subcategories: [
              { name: "Engine Oil", code: "FLD-OIL-ENG", description: "5W-30, 10W-40 motor oils" },
              { name: "Transmission Fluid", code: "FLD-OIL-TRN", description: "ATF, gear oil" },
              { name: "Brake Fluid", code: "FLD-OIL-BRK", description: "DOT 3, DOT 4 brake fluid" }
            ]
          },
          {
            name: "Coolants",
            code: "FLD-CLN",
            description: "Cooling system fluids",
            subcategories: [
              { name: "Antifreeze", code: "FLD-CLN-ANT", description: "Ethylene glycol coolants" },
              { name: "Washer Fluid", code: "FLD-CLN-WSH", description: "Windshield washer fluid" }
            ]
          }
        ]
      },
      {
        name: "Tires & Wheels",
        code: "TRW",
        description: "Tires, rims, and wheel accessories",
        subcategories: [
          { name: "Passenger Tires", code: "TRW-PSG", description: "Standard car tires" },
          { name: "Truck Tires", code: "TRW-TRK", description: "Light and heavy truck tires" },
          { name: "Alloy Wheels", code: "TRW-ALY", description: "Aluminum alloy rims" },
          { name: "Wheel Accessories", code: "TRW-ACC", description: "Lug nuts, hub caps, TPMS sensors" }
        ]
      },
      {
        name: "Body & Exterior",
        code: "BDY",
        description: "Body panels and exterior parts",
        subcategories: [
          {
            name: "Body Panels",
            code: "BDY-PNL",
            description: "Vehicle body panels",
            subcategories: [
              { name: "Fenders", code: "BDY-PNL-FND", description: "Front and rear fenders" },
              { name: "Bumpers", code: "BDY-PNL-BMP", description: "Front and rear bumpers" },
              { name: "Doors", code: "BDY-PNL-DOR", description: "Door shells, door skins" }
            ]
          },
          {
            name: "Lighting",
            code: "BDY-LGT",
            description: "Vehicle lighting",
            subcategories: [
              { name: "Headlights", code: "BDY-LGT-HDL", description: "Headlight assemblies" },
              { name: "Taillights", code: "BDY-LGT-TLL", description: "Taillight assemblies" },
              { name: "Bulbs", code: "BDY-LGT-BLB", description: "Replacement bulbs, LEDs" }
            ]
          }
        ]
      },
      {
        name: "Brakes & Suspension",
        code: "BRK",
        description: "Braking and suspension systems",
        subcategories: [
          {
            name: "Brake Components",
            code: "BRK-CMP",
            description: "Brake system parts",
            subcategories: [
              { name: "Brake Pads", code: "BRK-CMP-PAD", description: "Disc brake pads" },
              { name: "Brake Rotors", code: "BRK-CMP-RTR", description: "Brake discs and drums" },
              { name: "Calipers", code: "BRK-CMP-CAL", description: "Brake calipers" }
            ]
          },
          {
            name: "Suspension Parts",
            code: "BRK-SUS",
            description: "Suspension components",
            subcategories: [
              { name: "Shocks", code: "BRK-SUS-SHK", description: "Shock absorbers, struts" },
              { name: "Springs", code: "BRK-SUS-SPR", description: "Coil springs, leaf springs" },
              { name: "Control Arms", code: "BRK-SUS-CTL", description: "Control arms, ball joints" }
            ]
          }
        ]
      }
    ]
  },
  {
    name: "Food & Beverage",
    description: "Dry goods, refrigerated, frozen items, beverages, and food packaging",
    categories: [
      {
        name: "Dry Goods",
        code: "DRY",
        description: "Non-perishable food items",
        subcategories: [
          {
            name: "Grains & Cereals",
            code: "DRY-GRN",
            description: "Grain products",
            subcategories: [
              { name: "Rice", code: "DRY-GRN-RIC", description: "All varieties of rice" },
              { name: "Flour", code: "DRY-GRN-FLR", description: "Wheat, corn, specialty flours" },
              { name: "Pasta", code: "DRY-GRN-PST", description: "Dried pasta varieties" },
              { name: "Cereals", code: "DRY-GRN-CRL", description: "Breakfast cereals, oats" }
            ]
          },
          {
            name: "Canned & Preserved",
            code: "DRY-CAN",
            description: "Canned food products",
            subcategories: [
              { name: "Canned Vegetables", code: "DRY-CAN-VEG", description: "Canned vegetables" },
              { name: "Canned Fruits", code: "DRY-CAN-FRT", description: "Canned fruits, jams" },
              { name: "Canned Proteins", code: "DRY-CAN-PRO", description: "Canned meat, fish, beans" }
            ]
          },
          {
            name: "Condiments & Spices",
            code: "DRY-CND",
            description: "Seasonings and sauces",
            subcategories: [
              { name: "Spices", code: "DRY-CND-SPC", description: "Ground and whole spices" },
              { name: "Sauces", code: "DRY-CND-SAU", description: "Soy sauce, hot sauce, ketchup" },
              { name: "Oils & Vinegars", code: "DRY-CND-OIL", description: "Cooking oils, vinegars" }
            ]
          }
        ]
      },
      {
        name: "Refrigerated",
        code: "RFG",
        description: "Fresh perishable items",
        subcategories: [
          {
            name: "Dairy",
            code: "RFG-DRY",
            description: "Dairy products",
            subcategories: [
              { name: "Milk", code: "RFG-DRY-MLK", description: "Fresh milk, cream" },
              { name: "Cheese", code: "RFG-DRY-CHS", description: "Cheese varieties" },
              { name: "Yogurt", code: "RFG-DRY-YGT", description: "Yogurt, cultured products" }
            ]
          },
          {
            name: "Fresh Produce",
            code: "RFG-PRD",
            description: "Fresh fruits and vegetables",
            subcategories: [
              { name: "Vegetables", code: "RFG-PRD-VEG", description: "Fresh vegetables" },
              { name: "Fruits", code: "RFG-PRD-FRT", description: "Fresh fruits" },
              { name: "Herbs", code: "RFG-PRD-HRB", description: "Fresh herbs, greens" }
            ]
          },
          {
            name: "Proteins",
            code: "RFG-PRT",
            description: "Fresh meats and proteins",
            subcategories: [
              { name: "Poultry", code: "RFG-PRT-PLT", description: "Chicken, turkey, duck" },
              { name: "Red Meat", code: "RFG-PRT-RED", description: "Beef, lamb, pork" },
              { name: "Seafood", code: "RFG-PRT-SEA", description: "Fresh fish, shrimp, shellfish" }
            ]
          }
        ]
      },
      {
        name: "Frozen",
        code: "FRZ",
        description: "Frozen food products",
        subcategories: [
          { name: "Frozen Vegetables", code: "FRZ-VEG", description: "Frozen vegetable mixes" },
          { name: "Frozen Proteins", code: "FRZ-PRT", description: "Frozen meat, fish, poultry" },
          { name: "Frozen Meals", code: "FRZ-MEL", description: "Ready-to-eat frozen meals" },
          { name: "Ice Cream", code: "FRZ-ICE", description: "Ice cream, frozen desserts" }
        ]
      },
      {
        name: "Beverages",
        code: "BVR",
        description: "Drinks and beverage products",
        subcategories: [
          {
            name: "Non-Alcoholic",
            code: "BVR-NAL",
            description: "Non-alcoholic drinks",
            subcategories: [
              { name: "Water", code: "BVR-NAL-WTR", description: "Bottled water, sparkling water" },
              { name: "Juices", code: "BVR-NAL-JUI", description: "Fruit juices, concentrates" },
              { name: "Soft Drinks", code: "BVR-NAL-SFT", description: "Carbonated beverages" },
              { name: "Tea & Coffee", code: "BVR-NAL-TEA", description: "Tea, coffee, hot beverages" }
            ]
          },
          {
            name: "Alcoholic",
            code: "BVR-ALC",
            description: "Alcoholic beverages",
            subcategories: [
              { name: "Beer", code: "BVR-ALC-BER", description: "Beer, lager, ale" },
              { name: "Wine", code: "BVR-ALC-WIN", description: "Red, white, sparkling wines" },
              { name: "Spirits", code: "BVR-ALC-SPR", description: "Whisky, vodka, rum, gin" }
            ]
          }
        ]
      }
    ]
  },
  {
    name: "Healthcare",
    description: "Medicines, medical devices, lab supplies, PPE, and consumables",
    categories: [
      {
        name: "Pharmaceuticals",
        code: "PHR",
        description: "Medicinal products",
        subcategories: [
          {
            name: "Prescription Drugs",
            code: "PHR-PRX",
            description: "Prescription medications",
            subcategories: [
              { name: "Antibiotics", code: "PHR-PRX-ANT", description: "Antibiotic medications" },
              { name: "Analgesics", code: "PHR-PRX-ANL", description: "Pain relief medications" },
              { name: "Cardiovascular", code: "PHR-PRX-CRD", description: "Heart and BP medications" },
              { name: "Antidiabetics", code: "PHR-PRX-DBT", description: "Diabetes medications" }
            ]
          },
          {
            name: "OTC Medications",
            code: "PHR-OTC",
            description: "Over-the-counter medicines",
            subcategories: [
              { name: "Pain Relievers", code: "PHR-OTC-PNR", description: "Paracetamol, ibuprofen" },
              { name: "Cold & Flu", code: "PHR-OTC-CLD", description: "Cough syrups, decongestants" },
              { name: "Vitamins", code: "PHR-OTC-VIT", description: "Vitamins and supplements" }
            ]
          }
        ]
      },
      {
        name: "Medical Devices",
        code: "MDV",
        description: "Medical equipment and instruments",
        subcategories: [
          {
            name: "Diagnostic Equipment",
            code: "MDV-DGN",
            description: "Diagnostic devices",
            subcategories: [
              { name: "Blood Pressure", code: "MDV-DGN-BPR", description: "BP monitors, sphygmomanometers" },
              { name: "Thermometers", code: "MDV-DGN-THR", description: "Digital, infrared thermometers" },
              { name: "Glucometers", code: "MDV-DGN-GLU", description: "Blood glucose monitors" },
              { name: "Stethoscopes", code: "MDV-DGN-STH", description: "Stethoscopes" }
            ]
          },
          {
            name: "Surgical Instruments",
            code: "MDV-SRG",
            description: "Surgical tools",
            subcategories: [
              { name: "Scalpels", code: "MDV-SRG-SCP", description: "Surgical blades, handles" },
              { name: "Forceps", code: "MDV-SRG-FRC", description: "Tissue, hemostatic forceps" },
              { name: "Sutures", code: "MDV-SRG-SUT", description: "Suture materials, needles" }
            ]
          }
        ]
      },
      {
        name: "Lab Supplies",
        code: "LAB",
        description: "Laboratory consumables and equipment",
        subcategories: [
          {
            name: "Lab Consumables",
            code: "LAB-CON",
            description: "Disposable lab items",
            subcategories: [
              { name: "Test Tubes", code: "LAB-CON-TUB", description: "Test tubes, vials, containers" },
              { name: "Pipettes", code: "LAB-CON-PIP", description: "Pipette tips, transfer pipettes" },
              { name: "Slides", code: "LAB-CON-SLD", description: "Microscope slides, cover slips" }
            ]
          },
          {
            name: "Reagents",
            code: "LAB-REG",
            description: "Chemical reagents",
            subcategories: [
              { name: "Buffers", code: "LAB-REG-BUF", description: "pH buffers, solutions" },
              { name: "Stains", code: "LAB-REG-STN", description: "Gram stain, crystal violet" },
              { name: "Culture Media", code: "LAB-REG-CUL", description: "Agar, broth media" }
            ]
          }
        ]
      },
      {
        name: "Medical Consumables",
        code: "MCN",
        description: "Disposable medical supplies",
        subcategories: [
          {
            name: "Wound Care",
            code: "MCN-WND",
            description: "Wound management supplies",
            subcategories: [
              { name: "Bandages", code: "MCN-WND-BND", description: "Gauze, elastic bandages" },
              { name: "Dressings", code: "MCN-WND-DRS", description: "Adhesive, sterile dressings" },
              { name: "Antiseptics", code: "MCN-WND-ANT", description: "Betadine, alcohol swabs" }
            ]
          },
          {
            name: "PPE",
            code: "MCN-PPE",
            description: "Medical protective equipment",
            subcategories: [
              { name: "Gloves", code: "MCN-PPE-GLV", description: "Nitrile, latex, vinyl gloves" },
              { name: "Masks", code: "MCN-PPE-MSK", description: "Surgical masks, N95 respirators" },
              { name: "Gowns", code: "MCN-PPE-GWN", description: "Isolation gowns, scrubs" }
            ]
          }
        ]
      }
    ]
  },
  {
    name: "Hospitality",
    description: "Linen, amenities, kitchen supplies, cleaning, and furniture for hotels & restaurants",
    categories: [
      {
        name: "Linen & Textiles",
        code: "LIN",
        description: "Hotel and restaurant textiles",
        subcategories: [
          {
            name: "Bed Linen",
            code: "LIN-BED",
            description: "Bedding materials",
            subcategories: [
              { name: "Sheets", code: "LIN-BED-SHT", description: "Bed sheets, flat and fitted" },
              { name: "Pillowcases", code: "LIN-BED-PLW", description: "Pillow covers, protectors" },
              { name: "Duvet Covers", code: "LIN-BED-DVT", description: "Duvet covers, comforters" },
              { name: "Mattress Pads", code: "LIN-BED-MAT", description: "Mattress protectors, toppers" }
            ]
          },
          {
            name: "Bath Linen",
            code: "LIN-BTH",
            description: "Bathroom textiles",
            subcategories: [
              { name: "Bath Towels", code: "LIN-BTH-TWL", description: "Bath and hand towels" },
              { name: "Bath Mats", code: "LIN-BTH-MAT", description: "Floor mats, bath rugs" },
              { name: "Robes", code: "LIN-BTH-ROB", description: "Bathrobes, slippers" }
            ]
          },
          {
            name: "Table Linen",
            code: "LIN-TBL",
            description: "Restaurant table textiles",
            subcategories: [
              { name: "Tablecloths", code: "LIN-TBL-CLT", description: "Table covers, runners" },
              { name: "Napkins", code: "LIN-TBL-NAP", description: "Cloth and paper napkins" }
            ]
          }
        ]
      },
      {
        name: "Guest Amenities",
        code: "AMN",
        description: "Guest room amenities",
        subcategories: [
          {
            name: "Toiletries",
            code: "AMN-TLT",
            description: "Bathroom amenities",
            subcategories: [
              { name: "Shampoo", code: "AMN-TLT-SHP", description: "Shampoo, conditioner" },
              { name: "Soap", code: "AMN-TLT-SOP", description: "Bar soap, body wash" },
              { name: "Lotion", code: "AMN-TLT-LOT", description: "Body lotion, moisturizer" },
              { name: "Dental Kit", code: "AMN-TLT-DNT", description: "Toothbrush, toothpaste" }
            ]
          },
          {
            name: "Room Supplies",
            code: "AMN-ROM",
            description: "In-room guest supplies",
            subcategories: [
              { name: "Stationery", code: "AMN-ROM-STN", description: "Notepads, pens, folders" },
              { name: "Minibar", code: "AMN-ROM-MNB", description: "Minibar items, snacks" },
              { name: "Coffee & Tea", code: "AMN-ROM-COF", description: "Coffee sachets, tea bags" }
            ]
          }
        ]
      },
      {
        name: "Kitchen & Dining",
        code: "KTC",
        description: "Commercial kitchen equipment and supplies",
        subcategories: [
          {
            name: "Cookware",
            code: "KTC-CKW",
            description: "Cooking equipment",
            subcategories: [
              { name: "Pots & Pans", code: "KTC-CKW-POT", description: "Saucepans, frying pans, stockpots" },
              { name: "Bakeware", code: "KTC-CKW-BKW", description: "Baking trays, molds, sheets" },
              { name: "Utensils", code: "KTC-CKW-UTN", description: "Spatulas, ladles, tongs" }
            ]
          },
          {
            name: "Tableware",
            code: "KTC-TBW",
            description: "Dining service items",
            subcategories: [
              { name: "Plates", code: "KTC-TBW-PLT", description: "Dinner, side, dessert plates" },
              { name: "Glassware", code: "KTC-TBW-GLS", description: "Water, wine, cocktail glasses" },
              { name: "Cutlery", code: "KTC-TBW-CTL", description: "Forks, knives, spoons" }
            ]
          }
        ]
      },
      {
        name: "Cleaning Supplies",
        code: "CLN",
        description: "Housekeeping and cleaning products",
        subcategories: [
          {
            name: "Chemicals",
            code: "CLN-CHM",
            description: "Cleaning chemicals",
            subcategories: [
              { name: "Detergents", code: "CLN-CHM-DET", description: "Laundry, dishwashing detergent" },
              { name: "Disinfectants", code: "CLN-CHM-DIS", description: "Surface sanitizers" },
              { name: "Glass Cleaners", code: "CLN-CHM-GLS", description: "Window and glass cleaners" }
            ]
          },
          {
            name: "Equipment",
            code: "CLN-EQP",
            description: "Cleaning tools",
            subcategories: [
              { name: "Mops & Brooms", code: "CLN-EQP-MOP", description: "Mops, brooms, dustpans" },
              { name: "Vacuum Cleaners", code: "CLN-EQP-VAC", description: "Commercial vacuums" },
              { name: "Trolleys", code: "CLN-EQP-TRL", description: "Housekeeping carts, trolleys" }
            ]
          }
        ]
      }
    ]
  },
  {
    name: "Agriculture",
    description: "Seeds, fertilizers, pesticides, tools, irrigation, and animal feed",
    categories: [
      {
        name: "Seeds & Planting",
        code: "SED",
        description: "Seeds and planting materials",
        subcategories: [
          {
            name: "Crop Seeds",
            code: "SED-CRP",
            description: "Agricultural crop seeds",
            subcategories: [
              { name: "Grain Seeds", code: "SED-CRP-GRN", description: "Wheat, rice, corn, barley seeds" },
              { name: "Vegetable Seeds", code: "SED-CRP-VEG", description: "Tomato, pepper, lettuce seeds" },
              { name: "Fruit Seeds", code: "SED-CRP-FRT", description: "Fruit tree saplings, berry plants" },
              { name: "Legume Seeds", code: "SED-CRP-LEG", description: "Bean, lentil, pea seeds" }
            ]
          },
          {
            name: "Nursery Stock",
            code: "SED-NRS",
            description: "Seedlings and transplants",
            subcategories: [
              { name: "Seedlings", code: "SED-NRS-SDL", description: "Transplant-ready seedlings" },
              { name: "Grafted Plants", code: "SED-NRS-GRF", description: "Grafted fruit trees" }
            ]
          }
        ]
      },
      {
        name: "Fertilizers",
        code: "FRT",
        description: "Soil nutrients and amendments",
        subcategories: [
          {
            name: "Chemical Fertilizers",
            code: "FRT-CHM",
            description: "Synthetic fertilizers",
            subcategories: [
              { name: "Nitrogen", code: "FRT-CHM-NTR", description: "Urea, ammonium nitrate" },
              { name: "Phosphorus", code: "FRT-CHM-PHS", description: "DAP, superphosphate" },
              { name: "Potassium", code: "FRT-CHM-POT", description: "Muriate of potash, SOP" },
              { name: "NPK Blends", code: "FRT-CHM-NPK", description: "Compound NPK fertilizers" }
            ]
          },
          {
            name: "Organic Fertilizers",
            code: "FRT-ORG",
            description: "Natural soil amendments",
            subcategories: [
              { name: "Compost", code: "FRT-ORG-CMP", description: "Composted organic matter" },
              { name: "Manure", code: "FRT-ORG-MNR", description: "Animal manure, guano" },
              { name: "Bone Meal", code: "FRT-ORG-BON", description: "Bone meal, blood meal" }
            ]
          }
        ]
      },
      {
        name: "Crop Protection",
        code: "CRP",
        description: "Pesticides, herbicides, fungicides",
        subcategories: [
          {
            name: "Pesticides",
            code: "CRP-PST",
            description: "Insect control products",
            subcategories: [
              { name: "Insecticides", code: "CRP-PST-INS", description: "Insect control chemicals" },
              { name: "Herbicides", code: "CRP-PST-HRB", description: "Weed control products" },
              { name: "Fungicides", code: "CRP-PST-FNG", description: "Fungal disease control" }
            ]
          },
          {
            name: "Biological Control",
            code: "CRP-BIO",
            description: "Biocontrol agents",
            subcategories: [
              { name: "Beneficial Insects", code: "CRP-BIO-INS", description: "Ladybugs, parasitic wasps" },
              { name: "Biopesticides", code: "CRP-BIO-BPS", description: "Bt, neem-based products" }
            ]
          }
        ]
      },
      {
        name: "Farm Equipment",
        code: "FRM",
        description: "Agricultural tools and equipment",
        subcategories: [
          {
            name: "Hand Tools",
            code: "FRM-HND",
            description: "Manual farm tools",
            subcategories: [
              { name: "Hoes & Rakes", code: "FRM-HND-HOE", description: "Hoes, rakes, forks" },
              { name: "Pruning Tools", code: "FRM-HND-PRN", description: "Secateurs, loppers, saws" },
              { name: "Shovels", code: "FRM-HND-SHV", description: "Spades, shovels, trowels" }
            ]
          },
          {
            name: "Irrigation",
            code: "FRM-IRG",
            description: "Irrigation systems",
            subcategories: [
              { name: "Drip Systems", code: "FRM-IRG-DRP", description: "Drip tape, emitters, connectors" },
              { name: "Sprinklers", code: "FRM-IRG-SPR", description: "Sprinkler heads, pop-ups" },
              { name: "Pumps", code: "FRM-IRG-PMP", description: "Water pumps, submersible pumps" },
              { name: "Pipes & Fittings", code: "FRM-IRG-PIP", description: "PVC pipes, poly pipe, fittings" }
            ]
          }
        ]
      },
      {
        name: "Animal Feed",
        code: "FED",
        description: "Livestock and poultry feed",
        subcategories: [
          { name: "Cattle Feed", code: "FED-CTL", description: "Dairy and beef cattle feed" },
          { name: "Poultry Feed", code: "FED-PLT", description: "Layer, broiler, chick feed" },
          { name: "Fish Feed", code: "FED-FSH", description: "Aquaculture feed pellets" },
          { name: "Feed Supplements", code: "FED-SUP", description: "Minerals, vitamins, premixes" }
        ]
      }
    ]
  },
  {
    name: "Logistics",
    description: "Packaging, pallets, labels, containers, and shipping supplies",
    categories: [
      {
        name: "Shipping Boxes",
        code: "SHP",
        description: "Corrugated and specialty boxes",
        subcategories: [
          {
            name: "Standard Boxes",
            code: "SHP-STD",
            description: "Regular shipping boxes",
            subcategories: [
              { name: "Small Boxes", code: "SHP-STD-SML", description: "Small shipping cartons" },
              { name: "Medium Boxes", code: "SHP-STD-MED", description: "Medium shipping cartons" },
              { name: "Large Boxes", code: "SHP-STD-LRG", description: "Large and extra-large cartons" }
            ]
          },
          {
            name: "Specialty Boxes",
            code: "SHP-SPC",
            description: "Purpose-built packaging",
            subcategories: [
              { name: "Insulated Boxes", code: "SHP-SPC-INS", description: "Temperature-controlled packaging" },
              { name: "Hazmat Boxes", code: "SHP-SPC-HAZ", description: "UN-certified hazmat packaging" },
              { name: "Mailer Boxes", code: "SHP-SPC-MLR", description: "Flat mailers, book mailers" }
            ]
          }
        ]
      },
      {
        name: "Pallets & Containers",
        code: "PLT",
        description: "Bulk transport equipment",
        subcategories: [
          {
            name: "Pallets",
            code: "PLT-PAL",
            description: "Shipping pallets",
            subcategories: [
              { name: "Wood Pallets", code: "PLT-PAL-WOD", description: "Standard wood pallets" },
              { name: "Plastic Pallets", code: "PLT-PAL-PLS", description: "Reusable plastic pallets" },
              { name: "Euro Pallets", code: "PLT-PAL-EUR", description: "EUR/EPAL standard pallets" }
            ]
          },
          {
            name: "Containers",
            code: "PLT-CNT",
            description: "Reusable containers",
            subcategories: [
              { name: "Crates", code: "PLT-CNT-CRT", description: "Plastic and metal crates" },
              { name: "Totes", code: "PLT-CNT-TOT", description: "Stackable tote bins" },
              { name: "Drums", code: "PLT-CNT-DRM", description: "Steel and plastic drums" }
            ]
          }
        ]
      },
      {
        name: "Tape & Strapping",
        code: "TAP",
        description: "Sealing and securing materials",
        subcategories: [
          { name: "Packing Tape", code: "TAP-PCK", description: "Clear, brown packing tape" },
          { name: "Strapping", code: "TAP-STP", description: "Polypropylene, steel strapping" },
          { name: "Stretch Wrap", code: "TAP-STR", description: "Pallet wrap, stretch film" },
          { name: "Shrink Wrap", code: "TAP-SHR", description: "Heat shrink film and bags" }
        ]
      },
      {
        name: "Labels & Marking",
        code: "LBL",
        description: "Shipping labels and identification",
        subcategories: [
          {
            name: "Shipping Labels",
            code: "LBL-SHP",
            description: "Address and tracking labels",
            subcategories: [
              { name: "Thermal Labels", code: "LBL-SHP-THR", description: "Direct thermal labels" },
              { name: "Laser Labels", code: "LBL-SHP-LSR", description: "Laser printable labels" },
              { name: "Barcode Labels", code: "LBL-SHP-BRC", description: "Barcode stickers, QR labels" }
            ]
          },
          {
            name: "Hazard Labels",
            code: "LBL-HAZ",
            description: "GHS and safety labels",
            subcategories: [
              { name: "GHS Labels", code: "LBL-HAZ-GHS", description: "GHS diamond labels" },
              { name: "Fragile Labels", code: "LBL-HAZ-FRG", description: "Handle with care stickers" },
              { name: "Orientation", code: "LBL-HAZ-ORI", description: "This way up arrows" }
            ]
          }
        ]
      },
      {
        name: "Protective Materials",
        code: "PRM",
        description: "Cushioning and void fill",
        subcategories: [
          { name: "Bubble Wrap", code: "PRM-BBL", description: "Bubble wrap rolls and bags" },
          { name: "Foam Sheets", code: "PRM-FOM", description: "PE foam, EPE sheets" },
          { name: "Paper Fill", code: "PRM-PAP", description: "Kraft paper, honeycomb wrap" },
          { name: "Air Pillows", code: "PRM-AIR", description: "Inflatable air cushions" }
        ]
      }
    ]
  },
  {
    name: "General",
    description: "General warehouse supplies: cleaning, maintenance, safety, office, fuel",
    categories: [
      {
        name: "Cleaning Supplies",
        code: "GCL",
        description: "Facility cleaning products",
        subcategories: [
          {
            name: "Cleaning Chemicals",
            code: "GCL-CHM",
            description: "Cleaning agents",
            subcategories: [
              { name: "Floor Cleaners", code: "GCL-CHM-FLR", description: "Floor detergent, polish" },
              { name: "Sanitizers", code: "GCL-CHM-SAN", description: "Hand and surface sanitizers" },
              { name: "Degreasers", code: "GCL-CHM-DGR", description: "Industrial degreasers" }
            ]
          },
          {
            name: "Cleaning Tools",
            code: "GCL-TOL",
            description: "Cleaning equipment",
            subcategories: [
              { name: "Mops & Buckets", code: "GCL-TOL-MOP", description: "Mops, buckets, wringers" },
              { name: "Brooms", code: "GCL-TOL-BRM", description: "Brooms, dustpans, brushes" },
              { name: "Trash Bags", code: "GCL-TOL-TRS", description: "Garbage bags, liners" }
            ]
          }
        ]
      },
      {
        name: "Maintenance Supplies",
        code: "GMT",
        description: "Facility maintenance materials",
        subcategories: [
          {
            name: "Electrical",
            code: "GMT-ELC",
            description: "Electrical maintenance",
            subcategories: [
              { name: "Light Bulbs", code: "GMT-ELC-BLB", description: "LED, fluorescent, halogen bulbs" },
              { name: "Fuses", code: "GMT-ELC-FUS", description: "Fuses, circuit breakers" },
              { name: "Batteries", code: "GMT-ELC-BAT", description: "AA, AAA, 9V, specialty batteries" }
            ]
          },
          {
            name: "Plumbing",
            code: "GMT-PLM",
            description: "Plumbing maintenance",
            subcategories: [
              { name: "Pipe Repair", code: "GMT-PLM-PIP", description: "Pipe clamps, tape, putty" },
              { name: "Faucet Parts", code: "GMT-PLM-FCT", description: "Washers, cartridges, handles" }
            ]
          },
          {
            name: "Paints & Coatings",
            code: "GMT-PNT",
            description: "Surface coatings",
            subcategories: [
              { name: "Interior Paint", code: "GMT-PNT-INT", description: "Wall and ceiling paint" },
              { name: "Exterior Paint", code: "GMT-PNT-EXT", description: "Weather-resistant coatings" },
              { name: "Brushes & Rollers", code: "GMT-PNT-BRS", description: "Paint brushes, rollers, trays" }
            ]
          }
        ]
      },
      {
        name: "Safety Equipment",
        code: "GSF",
        description: "Workplace safety supplies",
        subcategories: [
          {
            name: "Fire Safety",
            code: "GSF-FIR",
            description: "Fire prevention and response",
            subcategories: [
              { name: "Extinguishers", code: "GSF-FIR-EXT", description: "Fire extinguishers by class" },
              { name: "Smoke Detectors", code: "GSF-FIR-SMK", description: "Smoke and heat detectors" },
              { name: "Fire Blankets", code: "GSF-FIR-BLK", description: "Fire blankets, suppression" }
            ]
          },
          {
            name: "First Aid",
            code: "GSF-FAD",
            description: "First aid supplies",
            subcategories: [
              { name: "First Aid Kits", code: "GSF-FAD-KIT", description: "Workplace first aid kits" },
              { name: "Eye Wash", code: "GSF-FAD-EYE", description: "Eye wash stations, solution" },
              { name: "AED", code: "GSF-FAD-AED", description: "Automated external defibrillators" }
            ]
          },
          {
            name: "Signage",
            code: "GSF-SGN",
            description: "Safety signs and markers",
            subcategories: [
              { name: "Warning Signs", code: "GSF-SGN-WRN", description: "Caution, danger signs" },
              { name: "Exit Signs", code: "GSF-SGN-EXT", description: "Emergency exit signs" },
              { name: "Floor Marking", code: "GSF-SGN-FLR", description: "Lane tape, hazard tape" }
            ]
          }
        ]
      },
      {
        name: "Office Consumables",
        code: "GOF",
        description: "General office and breakroom supplies",
        subcategories: [
          {
            name: "Breakroom",
            code: "GOF-BRK",
            description: "Pantry and breakroom items",
            subcategories: [
              { name: "Coffee & Tea", code: "GOF-BRK-COF", description: "Coffee, tea, sugar, creamer" },
              { name: "Disposables", code: "GOF-BRK-DSP", description: "Cups, plates, cutlery, napkins" },
              { name: "Water", code: "GOF-BRK-WTR", description: "Water dispenser, bottles" }
            ]
          },
          {
            name: "Restroom Supplies",
            code: "GOF-RST",
            description: "Washroom consumables",
            subcategories: [
              { name: "Toilet Paper", code: "GOF-RST-TPR", description: "Toilet tissue rolls" },
              { name: "Hand Towels", code: "GOF-RST-HTW", description: "Paper hand towels, dispensers" },
              { name: "Hand Soap", code: "GOF-RST-SOP", description: "Liquid soap, foam dispensers" }
            ]
          }
        ]
      },
      {
        name: "Fuel & Energy",
        code: "GFL",
        description: "Fuel and energy supplies",
        subcategories: [
          { name: "Diesel", code: "GFL-DSL", description: "Diesel fuel for vehicles and generators" },
          { name: "Petrol", code: "GFL-PTR", description: "Petrol / gasoline" },
          { name: "LPG", code: "GFL-LPG", description: "Liquefied petroleum gas" },
          { name: "Kerosene", code: "GFL-KRS", description: "Kerosene and paraffin" }
        ]
      }
    ]
  }
];
