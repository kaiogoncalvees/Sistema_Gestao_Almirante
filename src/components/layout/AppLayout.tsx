import { ReactNode, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Upload, FileText, Table, Menu, X, CreditCard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface AppLayoutProps {
  children: ReactNode;
}

const navigation = [
  { name: 'Dashboard',       icon: Home,       path: '/'               },
  { name: 'Importar',        icon: Upload,     path: '/cadastrar'      },
  { name: 'Detalhes',        icon: Table,      path: '/detalhes'       },
  { name: 'Contas a Pagar',  icon: CreditCard, path: '/contas-a-pagar' },
  { name: 'Relatórios',      icon: FileText,   path: '/relatorios'     },
];

export const AppLayout = ({ children }: AppLayoutProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background font-bold text-sm">FG</span>
            </div>
            <h1 className="text-lg font-bold text-foreground">Financeiro Gigante</h1>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden min-h-[44px] min-w-[44px]"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <nav className="md:hidden border-t border-border bg-card animate-fade-in">
            <div className="px-4 py-2 space-y-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors min-h-[48px]',
                      isActive
                        ? 'bg-foreground text-background'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.name}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-20 bg-card border-r border-border flex-col items-center py-6 z-40">
        <div className="mb-8">
          <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center">
            <span className="text-background font-bold text-sm">FG</span>
          </div>
        </div>

        <nav className="flex-1 flex flex-col gap-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={cn(
                  'w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 group relative',
                  isActive ? 'bg-foreground' : 'hover:bg-muted'
                )}
                title={item.name}
              >
                <item.icon
                  className={cn(
                    'w-5 h-5',
                    isActive ? 'text-background' : 'text-muted-foreground group-hover:text-foreground'
                  )}
                />
                <span className="absolute left-full ml-2 px-2 py-1 bg-foreground text-background text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                  {item.name}
                </span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="md:ml-20">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-50 safe-area-pb">
        <div className="flex items-center justify-around py-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <NavLink
                key={item.name}
                to={item.path}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-lg min-w-[64px] transition-colors',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                <item.icon className={cn('w-5 h-5', isActive && 'text-primary')} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
