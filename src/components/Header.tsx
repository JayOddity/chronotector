'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import GlobalSearch from './GlobalSearch';

interface HeaderProps {
  siteName: string;
}

interface SubMenuItem {
  name: string;
  href: string;
}

interface NavDropdownItem {
  name: string;
  href: string;
  children?: SubMenuItem[];
}

interface NavItem {
  label: string;
  href?: string;
  items?: NavDropdownItem[];
}

const navItems: NavItem[] = [
  {
    label: 'Database',
    href: '/database',
    items: [
      { name: 'Items', href: '/database' },
      { name: 'Weapons', href: '/database?category=Weapon' },
      { name: 'Armor', href: '/database?category=Armor' },
      { name: 'Consumables', href: '/database?category=Consumable' },
      { name: 'Materials', href: '/database?category=Material' },
      { name: 'Enemies', href: '/database?type=enemies' },
      { name: 'NPCs', href: '/database?type=npcs' },
      { name: 'Item Systems', href: '/database/systems' },
    ],
  },
  {
    label: 'Classes',
    href: '/classes',
    items: [
      { name: 'Assassin', href: '/classes/assassin' },
      { name: 'Berserker', href: '/classes/berserker' },
      { name: 'Paladin', href: '/classes/paladin' },
      { name: 'Ranger', href: '/classes/ranger' },
      { name: 'Sorcerer', href: '/classes/sorcerer' },
      { name: 'Swordsman', href: '/classes/swordsman' },
    ],
  },
  {
    label: 'Features',
    href: '/features',
    items: [
      { name: 'Combat', href: '/features/combat' },
      { name: 'Weapons', href: '/weapons' },
      {
        name: 'Professions',
        href: '/features/professions',
        children: [
          { name: 'Crafting', href: '/features/professions/crafting' },
          { name: 'Gathering', href: '/features/professions/gathering' },
        ],
      },
      { name: 'Gameplay', href: '/features/gameplay' },
      { name: 'PvP', href: '/features/pvp' },
      { name: 'PvE', href: '/features/pve' },
      { name: 'Activities', href: '/activities' },
    ],
  },
  {
    label: 'World',
    href: '/world',
    items: [
      { name: 'Lore', href: '/world/lore' },
      { name: 'Enemies', href: '/world/enemies' },
      { name: 'Dungeons', href: '/dungeons' },
      { name: 'Chronotector', href: '/chronotector' },
    ],
  },
  {
    label: 'FAQ',
    href: '/faq',
    items: [
      { name: 'FAQ', href: '/faq' },
      { name: 'Release Date', href: '/release-date' },
      { name: 'System Requirements', href: '/system-requirements' },
    ],
  },
  {
    label: 'Map',
    href: '/map',
  },
  {
    label: 'Talent Calculator',
    href: '/talent-calculator',
  },
];

export default function Header({ siteName }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <header className="sticky top-0 z-50 bg-[#15121b]/95 backdrop-blur">
      {/* Top bar: Logo + Search */}
      <div className="border-b border-border-subtle">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-12 gap-4">
            {/* Logo */}
            <Link href="/" className="shrink-0 flex items-center gap-2">
              <Image
                src="/logo.png"
                alt={`${siteName} logo`}
                width={32}
                height={32}
                priority
                className="w-8 h-8 object-contain"
              />
              <span className="font-heading text-lg text-text-primary hidden sm:inline">{siteName}</span>
            </Link>

            <div className="flex items-center gap-3 ml-auto shrink-0">
              <div className="hidden md:block">
                <GlobalSearch />
              </div>

              {/* Mobile menu button */}
              <button
                className="md:hidden p-2 text-text-secondary hover:text-accent-gold"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar: Navigation */}
      <div className="border-b border-border-subtle hidden md:block">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <nav className="flex items-center gap-1">
            {navItems.map((nav) =>
              !nav.items ? (
                <Link
                  key={nav.label}
                  href={nav.href!}
                  className="px-2 py-2 text-lg text-text-secondary hover:text-accent-gold hover:bg-accent-gold/10 rounded transition-colors font-medium whitespace-nowrap"
                >
                  {nav.label}
                </Link>
              ) : (
                <div
                  key={nav.label}
                  className="relative"
                  onMouseEnter={() => setOpenDropdown(nav.label)}
                  onMouseLeave={() => setOpenDropdown(null)}
                >
                  {nav.href ? (
                    <Link
                      href={nav.href}
                      className="px-2 py-2 text-lg text-text-secondary hover:text-accent-gold hover:bg-accent-gold/10 rounded transition-colors font-medium whitespace-nowrap inline-flex items-center gap-1"
                    >
                      {nav.label}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </Link>
                  ) : (
                    <button className="px-2 py-2 text-lg text-text-secondary hover:text-accent-gold hover:bg-accent-gold/10 rounded transition-colors font-medium whitespace-nowrap inline-flex items-center gap-1">
                      {nav.label}
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  )}
                  {openDropdown === nav.label && (
                    <div className="absolute top-full left-0 mt-0 w-48 bg-deep-night border border-border-subtle rounded-lg shadow-xl py-2">
                      {nav.items.map((item) => (
                        <div
                          key={item.name}
                          className="relative"
                          onMouseEnter={() => setHoveredItem(item.children ? item.name : null)}
                          onMouseLeave={() => setHoveredItem(null)}
                        >
                          <Link
                            href={item.href}
                            className="flex items-center justify-between px-4 py-2 text-sm text-text-secondary hover:text-accent-gold hover:bg-dark-surface transition-colors"
                          >
                            {item.name}
                            {item.children && (
                              <svg className="w-3 h-3 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            )}
                          </Link>
                          {item.children && hoveredItem === item.name && (
                            <div className="absolute left-full top-0 ml-0 w-44 bg-deep-night border border-border-subtle rounded-lg shadow-xl py-2">
                              {item.children.map((child) => (
                                <Link
                                  key={child.href}
                                  href={child.href}
                                  className="flex items-center gap-2 px-4 py-1.5 text-sm text-text-secondary hover:text-accent-gold hover:bg-dark-surface transition-colors"
                                >
                                  {child.name}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </nav>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden bg-deep-night border-t border-border-subtle">
          {navItems.map((nav) =>
            nav.href && !nav.items ? (
              <Link
                key={nav.label}
                href={nav.href}
                className="block px-4 py-2 text-sm text-text-secondary hover:text-accent-gold border-b border-border-subtle"
                onClick={() => setMobileOpen(false)}
              >
                {nav.label}
              </Link>
            ) : (
              <div key={nav.label} className="border-b border-border-subtle">
                {nav.href ? (
                  <Link href={nav.href} className="block px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider hover:text-accent-gold" onClick={() => setMobileOpen(false)}>
                    {nav.label}
                  </Link>
                ) : (
                  <div className="px-4 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider">
                    {nav.label}
                  </div>
                )}
                {nav.items?.map((item) => (
                  <div key={item.name}>
                    <Link
                      href={item.href}
                      className="block px-6 py-2 text-sm text-text-secondary hover:text-accent-gold"
                      onClick={() => setMobileOpen(false)}
                    >
                      {item.name}
                    </Link>
                    {item.children?.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block px-10 py-1.5 text-xs text-text-muted hover:text-accent-gold"
                        onClick={() => setMobileOpen(false)}
                      >
                        {child.name}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}
    </header>
  );
}
