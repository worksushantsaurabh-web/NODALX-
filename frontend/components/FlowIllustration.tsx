import React from 'react';
import { User, Sparkles, Mail, Database, Building2, ArrowDown } from 'lucide-react';

export default function FlowIllustration() {
  const nodes = [
    { 
      id: 'customer', 
      icon: User, 
      label: 'Customer', 
      color: 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700 shadow-md shadow-neutral-200/50 dark:shadow-none',
      iconColor: 'text-blue-500 dark:text-blue-400'
    },
    { 
      id: 'ai', 
      icon: Sparkles, 
      label: 'NODALxAI', 
      color: 'bg-neutral-600 text-white border-neutral-500 shadow-xl shadow-neutral-600/40 scale-110 z-10', 
      isGlow: true,
      iconColor: 'text-white'
    },
    { 
      id: 'email', 
      icon: Mail, 
      label: 'Email', 
      color: 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700 shadow-md shadow-neutral-200/50 dark:shadow-none',
      iconColor: 'text-purple-500 dark:text-purple-400'
    },
    { 
      id: 'crm', 
      icon: Database, 
      label: 'CRM', 
      color: 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-700 shadow-md shadow-neutral-200/50 dark:shadow-none',
      iconColor: 'text-orange-500 dark:text-orange-400'
    },
    { 
      id: 'business', 
      icon: Building2, 
      label: 'Business', 
      color: 'bg-neutral-900 dark:bg-neutral-950 text-white border-neutral-800 dark:border-neutral-800 shadow-xl shadow-neutral-900/20 dark:shadow-none',
      iconColor: 'text-neutral-300'
    },
  ];

  return (
    <div className="relative w-full max-w-md mx-auto min-h-[500px] md:aspect-[4/5] bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl rounded-[2rem] border border-neutral-200/80 dark:border-neutral-700/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] p-8 flex flex-col items-center justify-between overflow-hidden">
      
      {/* Premium subtle grid background with radial fade */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] dark:bg-[linear-gradient(to_right,#334155_1px,transparent_1px),linear-gradient(to_bottom,#334155_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)] opacity-60 dark:opacity-40"></div>

      <div className="relative z-10 flex flex-col items-center w-full h-full justify-between py-2">
        {nodes.map((node, index) => (
          <React.Fragment key={node.id}>
            {/* Node Card */}
            <div 
              className={`flex items-center gap-3.5 px-6 py-3.5 rounded-2xl border ${node.color} transition-transform duration-500 hover:scale-105 animate-float w-48 justify-center`}
              style={{ animationDelay: `${index * 0.4}s` }}
            >
              <node.icon className={`w-5 h-5 ${node.iconColor} ${node.isGlow ? 'animate-pulse-slow' : ''}`} />
              <span className="font-semibold tracking-wide text-sm">{node.label}</span>
            </div>

            {/* Connecting Line & Arrow */}
            {index < nodes.length - 1 && (
              <div className="flex flex-col items-center justify-center flex-1 w-full opacity-70 min-h-[32px]">
                <div className="w-0.5 h-full bg-gradient-to-b from-neutral-200 dark:from-neutral-700 to-neutral-300 dark:to-neutral-600 relative overflow-hidden rounded-full">
                   {/* Animated dot traveling down the line */}
                   <div 
                     className="absolute left-1/2 -translate-x-1/2 w-1.5 h-4 rounded-full bg-neutral-400 shadow-[0_0_8px_rgba(45,212,191,0.8)] animate-[travelDown_2s_ease-in-out_infinite]" 
                     style={{ animationDelay: `${index * 0.4}s` }}
                   ></div>
                </div>
                <ArrowDown className="w-4 h-4 text-neutral-300 dark:text-neutral-600 -mt-1.5" />
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
