export default function PaymentFooter() {
    return (
        <footer className="border-t border-gray-100 bg-white py-4 px-6 mt-8">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
                <div className="flex items-center gap-4 flex-wrap">
                    {/* VISA */}
                    <div className="bg-white border border-gray-200 rounded px-2 py-1 text-sm font-bold text-blue-800 italic">VISA</div>
                    {/* Mastercard */}
                    <div className="flex items-center gap-0.5">
                        <div className="w-6 h-6 bg-red-500 rounded-full opacity-80" />
                        <div className="w-6 h-6 bg-yellow-400 rounded-full -ml-3 opacity-80" />
                    </div>
                    {/* RuPay */}
                    <div className="bg-white border border-gray-200 rounded px-2 py-1 text-xs font-bold text-blue-700">RuPay</div>
                    {/* BHIM */}
                    <div className="bg-white border border-gray-200 rounded px-2 py-1 text-xs font-bold text-blue-900">BHIM</div>
                    {/* Net Banking */}
                    <div className="bg-white border border-gray-200 rounded px-2 py-1 text-xs text-gray-600">Net Banking</div>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <span>🔒</span>
                    <span>100% secured payments</span>
                </div>
            </div>
        </footer>
    );
}
