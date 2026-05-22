import { Home, Users, Grid, BarChart3, Settings } from 'lucide-react';
import { NavLink } from './NavLink';

const navigation = [
  { name: 'Dashboard', icon: Home, path: '/' },
  { name: 'Fornecedores', icon: Users, path: '/suppliers' },
  { name: 'Categorias', icon: Grid, path: '/categories' },
  { name: 'Relatórios', icon: BarChart3, path: '/reports' },
];

export const Sidebar = () => {
  return (
    <aside className="fixed left-0 top-0 h-screen w-20 bg-card border-r border-border flex flex-col items-center py-6 z-20">
      {/* Logo/App Name */}
      <div className="mb-8">
        <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
          <span className="text-background font-bold text-sm">AP</span>
        </div>
      </div>

      {/* Navigation Icons */}
      <nav className="flex-1 flex flex-col gap-2">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 hover:bg-muted group"
            activeClassName="bg-foreground"
          >
            <item.icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-[.bg-foreground]:text-background" />
          </NavLink>
        ))}
      </nav>

      {/* Settings at Bottom */}
      <NavLink
        to="/settings"
        className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 hover:bg-muted group"
        activeClassName="bg-foreground"
      >
        <Settings className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-[.bg-foreground]:text-background" />
      </NavLink>
    </aside>
  );
};
