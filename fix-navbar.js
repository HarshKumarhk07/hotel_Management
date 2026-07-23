const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'frontend/src/components/ui/Navbar.tsx');
let content = fs.readFileSync(file, 'utf8');

// Update desktop More dropdown
const desktopOld = `<button
              onClick={() => handleNavClick('/gallery')}
              className={\`transition-colors pb-1 border-b-2 \${
                pathname.startsWith('/gallery') ? 'text-[#D4AF37] border-[#D4AF37]' : 'border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37]'
              }\`}
            >
              Gallery
            </button>
            <button
              onClick={() => handleNavClick('/about')}
              className={\`transition-colors pb-1 border-b-2 \${
                pathname.startsWith('/about') ? 'text-[#D4AF37] border-[#D4AF37]' : 'border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37]'
              }\`}
            >
              About
            </button>
            <button
              onClick={() => handleNavClick('/contact')}
              className={\`transition-colors pb-1 border-b-2 \${
                pathname.startsWith('/contact') ? 'text-[#D4AF37] border-[#D4AF37]' : 'border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37]'
              }\`}
            >
              Contact
            </button>

            {/* More Dropdown */}
            <div className="relative group pb-1">
              <button
                className={\`flex items-center gap-1 transition-colors border-b-2 \${
                  pathname.startsWith('/facilities') || pathname === '/#amenities'
                    ? 'text-[#D4AF37] border-[#D4AF37]'
                    : 'border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37]'
                }\`}
              >
                More <ChevronDown className="h-3 w-3" />
              </button>
              
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300">
                <div className="flex flex-col gap-3 bg-black/90 backdrop-blur-md border border-white/10 rounded-xl p-4 min-w-[140px] shadow-2xl">
                  <button
                    onClick={() => handleScrollToSection('amenities')}
                    className="text-left text-white/80 hover:text-[#D4AF37] transition-colors py-1"
                  >
                    Amenities
                  </button>
                  <button
                    onClick={() => handleNavClick('/facilities')}
                    className={\`text-left transition-colors py-1 \${
                      pathname.startsWith('/facilities') ? 'text-[#D4AF37]' : 'text-white/80 hover:text-[#D4AF37]'
                    }\`}
                  >
                    Facilities
                  </button>
                </div>
              </div>
            </div>`;

const desktopNew = `{/* More Dropdown */}
            <div className="relative group pb-1">
              <button
                className={\`flex items-center gap-1 transition-colors border-b-2 \${
                  pathname.startsWith('/facilities') || pathname === '/#amenities' || pathname.startsWith('/gallery') || pathname.startsWith('/about') || pathname.startsWith('/contact')
                    ? 'text-[#D4AF37] border-[#D4AF37]'
                    : 'border-transparent hover:border-[#D4AF37] hover:text-[#D4AF37]'
                }\`}
              >
                More <ChevronDown className="h-3 w-3" />
              </button>
              
              <div className="absolute top-full left-1/2 -translate-x-1/2 pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300">
                <div className="flex flex-col gap-3 bg-black/90 backdrop-blur-md border border-white/10 rounded-xl p-4 min-w-[140px] shadow-2xl">
                  <button
                    onClick={() => handleNavClick('/gallery')}
                    className={\`text-left transition-colors py-1 \${
                      pathname.startsWith('/gallery') ? 'text-[#D4AF37]' : 'text-white/80 hover:text-[#D4AF37]'
                    }\`}
                  >
                    Gallery
                  </button>
                  <button
                    onClick={() => handleNavClick('/about')}
                    className={\`text-left transition-colors py-1 \${
                      pathname.startsWith('/about') ? 'text-[#D4AF37]' : 'text-white/80 hover:text-[#D4AF37]'
                    }\`}
                  >
                    About
                  </button>
                  <button
                    onClick={() => handleNavClick('/contact')}
                    className={\`text-left transition-colors py-1 \${
                      pathname.startsWith('/contact') ? 'text-[#D4AF37]' : 'text-white/80 hover:text-[#D4AF37]'
                    }\`}
                  >
                    Contact
                  </button>
                  <button
                    onClick={() => handleScrollToSection('amenities')}
                    className="text-left text-white/80 hover:text-[#D4AF37] transition-colors py-1"
                  >
                    Amenities
                  </button>
                  <button
                    onClick={() => handleNavClick('/facilities')}
                    className={\`text-left transition-colors py-1 \${
                      pathname.startsWith('/facilities') ? 'text-[#D4AF37]' : 'text-white/80 hover:text-[#D4AF37]'
                    }\`}
                  >
                    Facilities
                  </button>
                </div>
              </div>
            </div>`;


// Update mobile More section
const mobileOld = `<button
                onClick={() => handleNavClick('/gallery')}
                className={\`text-left \${pathname.startsWith('/gallery') ? 'text-[#D4AF37]' : 'text-white hover:text-[#D4AF37]'}\`}
              >
                Gallery
              </button>
              <button
                onClick={() => handleNavClick('/about')}
                className={\`text-left \${pathname.startsWith('/about') ? 'text-[#D4AF37]' : 'text-white hover:text-[#D4AF37]'}\`}
              >
                About
              </button>
              <button
                onClick={() => handleNavClick('/contact')}
                className={\`text-left \${pathname.startsWith('/contact') ? 'text-[#D4AF37]' : 'text-white hover:text-[#D4AF37]'}\`}
              >
                Contact
              </button>
              
              <div className="pt-2 pb-1 border-b border-white/10 text-white/50">More</div>
              <button
                onClick={() => handleScrollToSection('amenities')}
                className="text-white/80 hover:text-[#D4AF37] text-left pl-2"
              >
                Amenities
              </button>
              <button
                onClick={() => handleNavClick('/facilities')}
                className={\`text-left pl-2 \${pathname.startsWith('/facilities') ? 'text-[#D4AF37]' : 'text-white/80 hover:text-[#D4AF37]'}\`}
              >
                Facilities
              </button>`;

const mobileNew = `<div className="pt-2 pb-1 border-b border-white/10 text-white/50">More</div>
              <button
                onClick={() => handleNavClick('/gallery')}
                className={\`text-left pl-2 \${pathname.startsWith('/gallery') ? 'text-[#D4AF37]' : 'text-white/80 hover:text-[#D4AF37]'}\`}
              >
                Gallery
              </button>
              <button
                onClick={() => handleNavClick('/about')}
                className={\`text-left pl-2 \${pathname.startsWith('/about') ? 'text-[#D4AF37]' : 'text-white/80 hover:text-[#D4AF37]'}\`}
              >
                About
              </button>
              <button
                onClick={() => handleNavClick('/contact')}
                className={\`text-left pl-2 \${pathname.startsWith('/contact') ? 'text-[#D4AF37]' : 'text-white/80 hover:text-[#D4AF37]'}\`}
              >
                Contact
              </button>
              <button
                onClick={() => handleScrollToSection('amenities')}
                className="text-white/80 hover:text-[#D4AF37] text-left pl-2"
              >
                Amenities
              </button>
              <button
                onClick={() => handleNavClick('/facilities')}
                className={\`text-left pl-2 \${pathname.startsWith('/facilities') ? 'text-[#D4AF37]' : 'text-white/80 hover:text-[#D4AF37]'}\`}
              >
                Facilities
              </button>`;

let updated = content;
if(updated.includes(desktopOld)) updated = updated.replace(desktopOld, desktopNew);
else console.warn("Desktop string not found");

if(updated.includes(mobileOld)) updated = updated.replace(mobileOld, mobileNew);
else console.warn("Mobile string not found");

fs.writeFileSync(file, updated, 'utf8');
console.log('Navbar layout updated successfully');
