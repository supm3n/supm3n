// src/data/projects.js
export const projects = [
  {
    name: "Planet Now",
    description: "Day and night, the last 24 hours of earthquakes and the ISS, live on a dotted world map.",
    url: "/planet",
    tag: "Live",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="6"></circle><ellipse cx="12" cy="12" rx="11" ry="4" transform="rotate(-20 12 12)"></ellipse></svg>`,
    featured: true
  },
  {
    name: "Above You",
    description: "Your sky right now: stars, planets, the Moon and satellites passing overhead.",
    url: "/sky",
    tag: "Live",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`,
    featured: true
  },
  {
    name: "Fingerprint",
    description: "How websites recognise your browser without cookies, turned into a sigil that is yours.",
    url: "/fingerprint",
    tag: "Privacy",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 11a7 7 0 0 1 14 0v2"></path><path d="M8 9.5a4 4 0 0 1 8 0V14a4 4 0 0 1-1 2.6"></path><path d="M12 11v4"></path><path d="M8 13v1a4 4 0 0 0 1 2.6"></path><path d="M5 15a7 7 0 0 0 2 4.5"></path></svg>`,
    featured: true
  },
  {
    name: "Black-Peg Mastermind",
    description: "Solver and simulator for Mastermind where only right-place pegs are given.",
    url: "/black-peg-mastermind",
    tag: "Puzzle",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="4.5" cy="9" r="2.5"></circle><circle cx="12" cy="9" r="2.5"></circle><circle cx="19.5" cy="9" r="2.5"></circle><line x1="3" y1="17" x2="21" y2="17"></line><circle cx="8" cy="17" r="1" fill="currentColor"></circle><circle cx="12" cy="17" r="1" fill="currentColor"></circle></svg>`,
    featured: true
  },
  {
    name: "Settle Up",
    description: "A tool to split expenses (Ephemeral). No data is saved.",
    url: "/settleup",
    tag: "Tool",
    //icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" transform="rotate(180 12 12) translate(0 4)"/><path d="M3 12v5h16a2 2 0 0 1 0 4H5v-4" transform="translate(0 -4)"/><polyline points="7 3 3 7 7 11"/><polyline points="17 13 21 17 17 21"/></svg>`,
    //icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 4v16m-7-8l4-4 4 4m-4-4v16"/><path d="M7 20V4m-4 4l4-4 4 4"/></svg>`,
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10h14l-4-4"/><path d="M17 14H3l4 4"/></svg>`,
    featured: true
  },
  {
    name: "Stocks Viewer",
    description: "Stock and crypto price charts using Twelve Data.",
    url: "/stock-viewer",
    tag: "Finance",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`,
    featured: true
  },

  {
    name: "Snake",
    description: "Classic snake game built with Vanilla JS.",
    url: "/snake",
    tag: "Game",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22v-2c0-3 4-2 4-6s-4-3-4-6" /><circle cx="12" cy="8" r="3" /><path d="M12 5V3" /><path d="M12 3L10 1" /><path d="M12 3L14 1" /></svg>`,
    featured: true
  },
  {
    name: "IP Trace",
    description: "Your IP address and what every website can see about you, on a zooming world map.",
    url: "/trace",
    tag: "Tool",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>`,
    featured: true
  },
  {
    name: "Entropy Grid",
    description: "Interactive cellular automaton simulation. High-performance logic fluids.",
    url: "/entropy",
    tag: "Sim",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>`,
    featured: true
  },
  {
    name: "Financial Analysis",
    description: "Financial analysis tool using SEC filings.",
    url: "/financial-analysis",
    tag: "Finance",
    icon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`,
    featured: true
  }
];
