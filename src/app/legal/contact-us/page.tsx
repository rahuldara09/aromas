import React from 'react';

export default function ContactUs() {
    return (
        <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-black text-gray-900 tracking-tight mb-8">Contact Us</h1>

            <div className="prose prose-gray max-w-none text-gray-700 bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-lg mb-8">You may contact us using the information below:</p>

                <div className="space-y-6">
                    <div>
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Merchant Legal Entity Name</h2>
                        <p className="font-semibold text-gray-900">AROMAS DELIGHT CATERING SERVICE</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Registered Address</h2>
                            <p className="text-gray-900 leading-relaxed">
                                Near Dorm 15<br />
                                IIM Ahmedabad Campus, Vastrapur<br />
                                Ahmedabad, Gujarat<br />
                                PIN: 380015
                            </p>
                        </div>

                        <div>
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Operational Address</h2>
                            <p className="text-gray-900 leading-relaxed">
                                Near Dorm 15<br />
                                IIM Ahmedabad Campus, Vastrapur<br />
                                Ahmedabad, Gujarat<br />
                                PIN: 380015
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-gray-100">
                        <div>
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Telephone No</h2>
                            <p className="font-semibold text-gray-900 text-lg">9892820940</p>
                        </div>

                        <div>
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">E-Mail ID</h2>
                            <a href="mailto:satishsakhreh1@gmail.com" className="font-semibold text-red-500 hover:text-red-600 transition-colors text-lg">satishsakhreh1@gmail.com</a>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
