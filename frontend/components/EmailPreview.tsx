import { Mail, Sparkles } from 'lucide-react';

export default function EmailPreview() {
  const emailPayload = {
    id: "email_9823749823",
    inquiryId: "FP-48291",
    to: "sarah.jenkins@techflow.com",
    from: "alex@example.com",
    subject: "Re: Enterprise AI Automation Inquiry",
    body: "Hi Sarah,\n\nThank you for reaching out to NodalX.\n\nI understand you're looking for an enterprise AI automation solution to streamline your inbound sales pipeline, with a target implementation of 30 days.\n\nGiven your requirements, I'd love to show you a tailored technical demo of how NodalX can integrate directly with your existing CRM to handle your lead volume instantly.\n\nAre you available for a brief 15-minute call this Thursday?\n\nBest regards,\n\nAlex\nNodalX Team",
    status: "draft",
    aiConfidenceScore: 0.98,
    createdAt: new Date().toISOString()
  };

  return (
    <section id="email-draft" className="relative py-24 lg:py-32 bg-white  border-t border-neutral-100  overflow-hidden transition-colors duration-300">
      {/* Subtle Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-gradient-to-tr from-neutral-50/50  to-transparent blur-3xl opacity-60"></div>
      </div>

      <div className="max-w-4xl mx-auto px-6 md:px-12 relative z-10">
        <div className="text-center mb-12 md:mb-16 animate-fade-in-up">
          <h2 className="text-xs font-bold tracking-widest text-black   uppercase mb-3 flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            Auto-Drafted Response
          </h2>
          <h3 className="text-3xl md:text-4xl font-extrabold text-neutral-900  tracking-tight mb-4">
            Ready to Send
          </h3>
          <p className="text-lg text-text-tertiary  max-w-2xl mx-auto leading-relaxed">
            NodalX instantly drafts a highly personalized, context-aware email based on the customer's inquiry and AI analysis.
          </p>
        </div>

        <div className="relative animate-fade-in-up group" style={{ animationDelay: '0.2s' }}>
          {/* Email Client Mockup */}
          <div className="bg-white  rounded-2xl border border-neutral-200/80  shadow-2xl shadow-neutral-200/40  overflow-hidden flex flex-col transition-all duration-500 group-hover:shadow-3xl group-hover:-translate-y-1">
            
            {/* Mock Browser/App Header */}
            <div className="bg-neutral-50/80  border-b border-neutral-200/80  px-5 py-3 flex items-center justify-between ">
              <div className="flex items-center gap-4">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-neutral-300 "></div>
                  <div className="w-3 h-3 rounded-full bg-neutral-300 "></div>
                  <div className="w-3 h-3 rounded-full bg-neutral-300 "></div>
                </div>
                <div className="px-2.5 py-1 bg-neutral-50   rounded-md border border-neutral-100   text-xs font-bold text-neutral-800  flex items-center gap-1.5 shadow-sm">
                  <Sparkles className="w-3 h-3" />
                  AI Draft
                </div>
              </div>
              <div className="text-xs font-medium text-text-secondary ">
                Saved just now
              </div>
            </div>

            {/* Email Headers */}
            <div className="px-6 py-4 border-b border-neutral-100  bg-white  space-y-3">
              <div className="flex items-center text-sm">
                <span className="w-16 text-text-secondary  font-medium">To:</span>
                <span className="px-2.5 py-1 bg-neutral-100  text-neutral-700  rounded-md font-medium border border-neutral-200/60 ">
                  {emailPayload.to}
                </span>
              </div>
              <div className="flex items-center text-sm">
                <span className="w-16 text-text-secondary  font-medium">From:</span>
                <span className="text-neutral-700  font-medium">{emailPayload.from}</span>
              </div>
              <div className="flex items-center text-sm">
                <span className="w-16 text-text-secondary  font-medium">Subject:</span>
                <span className="text-neutral-900  font-bold">{emailPayload.subject}</span>
              </div>
            </div>

            {/* Email Body */}
            <div className="p-6 md:p-8 bg-white ">
              <div className="prose prose-slate  max-w-none">
                <p className="text-neutral-700  leading-relaxed whitespace-pre-wrap font-sans text-[15px]">
                  {emailPayload.body}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
