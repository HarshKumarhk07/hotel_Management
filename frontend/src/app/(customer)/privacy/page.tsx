import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-neutral-50 py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
        <div className="bg-primary/5 px-8 py-10 border-b border-primary/10">
          <h1 className="text-3xl font-bold text-neutral-900 tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-neutral-600">Last updated: {new Date().toLocaleDateString()}</p>
        </div>
        
        <div className="p-8 space-y-8 text-neutral-600 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">1. Information We Collect</h2>
            <p>
              We collect information you provide directly to us when you book a room, use our restaurant services, 
              or contact us. This may include your name, email address, phone number, payment information, 
              and any other details you choose to provide during your stay or interactions with our hotel.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">2. How We Use Your Information</h2>
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Process your reservations and transactions</li>
              <li>Provide, maintain, and improve our hotel services</li>
              <li>Send you technical notices, updates, and support messages</li>
              <li>Respond to your comments, questions, and customer service requests</li>
              <li>Communicate with you about promotions, events, and other news</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">3. Data Security</h2>
            <p>
              We take reasonable measures to help protect information about you from loss, theft, misuse, 
              and unauthorized access, disclosure, alteration, and destruction. Your payment information 
              is processed securely through our trusted payment partners and is never stored in plain text on our servers.
            </p>
          </section>
          
          <section>
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">4. Sharing of Information</h2>
            <p>
              We do not share your personal information with third parties except as necessary to provide our services 
              (such as processing payments), comply with the law, or protect our rights. We do not sell your personal 
              information to marketing agencies or third-party advertisers.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-neutral-900 mb-4">5. Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy or our data practices, please contact us at:
            </p>
            <div className="mt-4 p-4 bg-neutral-50 rounded-lg border border-neutral-100">
              <p className="font-medium text-neutral-900">The Hotel Management Team</p>
              <p>Email: privacy@hotel.com</p>
              <p>Phone: +1 (555) 123-4567</p>
            </div>
          </section>
        </div>
        
        <div className="bg-neutral-50 px-8 py-6 border-t border-neutral-100 text-sm text-center">
          <p>
            Return to <Link href="/" className="text-primary font-medium hover:underline">Home Page</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
