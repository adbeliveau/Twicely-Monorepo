import {
  LayoutDashboard, Users, UserPlus, CreditCard, DollarSign, Shield,
  Headphones, BookOpen, Tag, AlertTriangle, RotateCcw, BarChart2, Crown,
  FolderOpen, Bell, Flag, Settings, UserCog, ClipboardList, Activity,
  Archive, Coins, ShieldCheck, Truck, Puzzle, Server, Plug, Database,
  GitBranch, Sliders, SlidersHorizontal, Terminal, MessageSquareWarning,
  ShoppingCart, Banknote, Star, MapPin, Receipt, Ticket, Scale,
  Stethoscope, FileText, Gavel, Layers, Clock, ShoppingBag, RefreshCw,
  Search, Globe, Languages, Calculator, Store, TrendingUp, EyeOff,
  Grid, Lock, Menu,
  type LucideIcon,
} from "lucide-react";

/**
 * Icon map for sidebar navigation items.
 * Keys match the `icon` string values in ADMIN_NAV (admin-nav.ts).
 * Uses lucide-react components for tree-shaking and consistency.
 */
export const SIDEBAR_ICON_MAP: Record<string, LucideIcon> & { _default: LucideIcon } = {
  LayoutDashboard, Users, UserPlus, CreditCard, DollarSign, Shield,
  Headphones, BookOpen, Tag, AlertTriangle, RotateCcw, BarChart2, Crown,
  FolderOpen, Bell, Flag, Settings, UserCog, ClipboardList, Activity,
  Archive, Coins, ShieldCheck, Truck, Puzzle, Server, Plug, Database,
  GitBranch, Sliders, SlidersHorizontal, Terminal, MessageSquareWarning,
  ShoppingCart, Banknote, Star, MapPin, Receipt, Ticket, Scale,
  Stethoscope, FileText, Gavel, Layers, Clock, ShoppingBag, RefreshCw,
  Search, Globe, Languages, Calculator, Store, TrendingUp, EyeOff,
  Grid, Lock,
  _default: Menu,
};
