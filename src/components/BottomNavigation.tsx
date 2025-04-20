'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BookOpen, Compass } from 'lucide-react';

const BottomNavigation = () => {
  const pathname = usePathname();

  const navItems = [
    {
      path: '/',
      name: 'Accueil',
      icon: Home,
    },
    {
      path: '/quran',
      name: 'Coran',
      icon: BookOpen,
    },
    {
      path: '/qibla',
      name: 'Qibla',
      icon: Compass,
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 shadow-lg dark:shadow-gray-950/50 rounded-t-xl z-50">
      <div className="flex justify-around py-3">
        {navItems.map((item) => {
          const isActive = pathname === item.path;
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className="flex flex-col items-center w-1/3"
            >
              <div className={`p-2 rounded-full transition-colors ${isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                <item.icon className={`w-5 h-5 ${isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`} size={20} />
              </div>
              <span className={`text-xs mt-1 font-medium ${isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default BottomNavigation; 