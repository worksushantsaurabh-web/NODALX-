import React from 'react';
import { Users, Flame, Clock, CheckCircle2, ArrowUpRight, ArrowDownRight, MoreHorizontal, LayoutDashboard, Search, Filter, Eye } from 'lucide-react';

const stats = [
  {
    title: "Today's Leads",
    value: '124',
    trend: '+12%',
    isPositive: true,
    icon: Users,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-500/10',
    borderColor: 'border-blue-100 dark:border-blue-500/20',
  },
  {
    title: 'Hot Leads',
    value: '28',
    trend: '+5%',
    isPositive: true,
    icon: Flame,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-500/10',
    borderColor: 'border-orange-100 dark:border-orange-500/20',
  },
  {
    title: 'Pending Leads',
    value: '15',
    trend: '-2%',
    isPositive: true, // Fewer pending is good
    icon: Clock,
    color: 'text-amber-600 dark:text-amber-400',
    bgColor: 'bg-amber-50 dark:bg-amber-500/10',
    borderColor: 'border-amber-100 dark:border-amber-500/20',
  },
  {
    title: 'Closed Leads',
    value: '81',
    trend: '+18%',
    isPositive: true,
    icon: CheckCircle2,
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-500/10',
    borderColor: 'border-emerald-100 dark:border-emerald-500/20',
  },
];

const recentInquiries = [
  {
    id: '1',
    name: 'Sarah Jenkins',
    company: 'TechFlow Inc.',
    intent: 'High',
    status: 'Qualified',
    time: '2 mins ago',
    avatar: 'https://i.pravatar.cc/150?img=47',
  },
  {
    id: '2',
    name: 'Michael Chen',
    company: 'Nexus Dynamics',
    intent: 'Medium',
    status: 'Pending',
    time: '15 mins ago',
    avatar: 'https://i.pravatar.cc/150?img=11',
  },
  {
    id: '3',
    name: 'Emma Watson',
    company: 'Global Retail',
    intent: 'High',
    status: 'Qualified',
    time: '1 hour ago',
    avatar: 'https://i.pravatar.cc/150?img=5',
  },
  {
    id: '4',
    name: 'David Miller',
    company: 'Stark Industries',
    intent: 'Low',
    status: 'Archived',
    time: '3 hours ago',
    avatar: 'https://i.pravatar.cc/150?img=60',
  },
];

export default function DashboardPreview() {
  return (
    <section id="pipeline" className="relative py-24 lg:py-32 bg-white dark:bg-neutral-950 overflow-hidden border-t border-neutral-100 dark:border-neutral-800/50 transition-colors duration-300">
      {/* Subtle Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full pointer-events-none">
        <div className="absolute top-1/3 right-0 w-[500px] h-[500px] bg-neutral-50 dark:bg-neutral-900/10 rounded-full blur-3xl animate-pulse-slow"></div>
      </div>

      <div className="max-w-6xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center max-w-2xl mx-auto mb-16 animate-fade-in-up">
          <h2 className="text-xs font-bold tracking-widest text-neutral-600 dark:text-neutral-400 uppercase mb-3 flex items-center justify-center gap-2">
            <LayoutDashboard className="w-4 h-4" />
            Command Center
          </h2>
          <h3 className="text-3xl md:text-4xl font-extrabold text-neutral-900 dark:text-white tracking-tight mb-4">
            Manage Your Pipeline
          </h3>
          <p className="text-lg text-neutral-500 dark:text-neutral-400 leading-relaxed">
            Track incoming leads, monitor AI qualification status, and close deals faster from a centralized, intuitive dashboard.
          </p>
        </div>

        {/* Dashboard UI Mockup */}
        <div className="relative mx-auto animate-fade-in-up group" style={{ animationDelay: '0.2s' }}>
          
          {/* Preview Badge */}
          <div className="absolute -top-4 -right-4 bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 px-4 py-1.5 rounded-full text-xs font-bold shadow-xl z-20 flex items-center gap-1.5 border border-neutral-700 dark:border-neutral-200 animate-float">
            <Eye className="w-3.5 h-3.5" />
            Preview Only
          </div>

          {/* Main Dashboard Card - Added pointer-events-none to disable interaction */}
          <div className="bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200/80 dark:border-neutral-800 shadow-2xl shadow-neutral-200/40 dark:shadow-none overflow-hidden flex flex-col transition-all duration-500 group-hover:shadow-3xl group-hover:-translate-y-1 pointer-events-none select-none">
            
            {/* Mock Browser/App Header */}
            <div className="bg-neutral-50/80 dark:bg-neutral-950/50 border-b border-neutral-200/80 dark:border-neutral-800 px-5 py-3 flex items-center justify-between backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-700"></div>
                  <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-700"></div>
                  <div className="w-3 h-3 rounded-full bg-neutral-300 dark:bg-neutral-700"></div>
                </div>
                <div className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 flex items-center gap-2">
                  Pipeline Overview
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg text-xs text-neutral-400 dark:text-neutral-500 shadow-sm">
                  <Search className="w-3 h-3" />
                  Search leads...
                </div>
                <div className="w-7 h-7 rounded-full bg-neutral-600 dark:bg-neutral-500 text-white flex items-center justify-center text-xs font-bold shadow-sm">
                  JD
                </div>
              </div>
            </div>

            {/* Dashboard Content */}
            <div className="p-6 md:p-8 bg-neutral-50/30 dark:bg-neutral-950/30">
              
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 mb-8">
                {stats.map((stat, index) => (
                  <div key={index} className="bg-white dark:bg-neutral-900 rounded-xl p-5 border border-neutral-200/80 dark:border-neutral-800 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className={`w-10 h-10 rounded-lg ${stat.bgColor} border ${stat.borderColor} flex items-center justify-center`}>
                        <stat.icon className={`w-5 h-5 ${stat.color}`} />
                      </div>
                      <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md ${stat.isPositive ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'}`}>
                        {stat.isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {stat.trend}
                      </div>
                    </div>
                    <h4 className="text-neutral-500 dark:text-neutral-400 text-sm font-medium mb-1">{stat.title}</h4>
                    <div className="text-2xl font-extrabold text-neutral-900 dark:text-white tracking-tight">{stat.value}</div>
                  </div>
                ))}
              </div>

              {/* Recent Inquiries Table Section */}
              <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between bg-white dark:bg-neutral-900">
                  <h3 className="text-base font-bold text-neutral-900 dark:text-white">Recent Inquiries</h3>
                  <button className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 px-3 py-1.5 rounded-md border border-neutral-200 dark:border-neutral-700 shadow-sm">
                    <Filter className="w-3.5 h-3.5" />
                    Filter
                  </button>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-neutral-50/80 dark:bg-neutral-800/50 text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400 font-semibold border-b border-neutral-200/80 dark:border-neutral-800">
                        <th className="px-6 py-3.5">Customer</th>
                        <th className="px-6 py-3.5">Intent</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5">Time</th>
                        <th className="px-6 py-3.5 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                      {recentInquiries.map((inquiry, index) => (
                        <tr key={inquiry.id} className="bg-white dark:bg-neutral-900 animate-fade-in-up" style={{ animationDelay: `${index * 0.1}s` }}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <img src={inquiry.avatar} alt={inquiry.name} className="w-8 h-8 rounded-full border border-neutral-200 dark:border-neutral-700" />
                              <div>
                                <div className="font-bold text-neutral-900 dark:text-white text-sm">{inquiry.name}</div>
                                <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">{inquiry.company}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {inquiry.intent === 'High' && <Flame className="w-4 h-4 text-orange-500 dark:text-orange-400" />}
                              <span className={`text-sm font-semibold ${inquiry.intent === 'High' ? 'text-orange-600 dark:text-orange-400' : 'text-neutral-600 dark:text-neutral-400'}`}>
                                {inquiry.intent}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold border ${
                              inquiry.status === 'Qualified' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200/60 dark:border-emerald-500/20' :
                              inquiry.status === 'Pending' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200/60 dark:border-amber-500/20' :
                              'bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 border-neutral-200 dark:border-neutral-700'
                            }`}>
                              {inquiry.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-neutral-500 dark:text-neutral-400">
                            {inquiry.time}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <button className="p-1.5 text-neutral-400 dark:text-neutral-500 rounded-md">
                              <MoreHorizontal className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-6 py-3.5 border-t border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/50 text-center">
                  <button className="text-xs font-bold text-neutral-600 dark:text-neutral-400">
                    View all inquiries &rarr;
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
