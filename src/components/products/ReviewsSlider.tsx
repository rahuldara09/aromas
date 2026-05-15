'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight, Quote, Users } from 'lucide-react';
import Image from 'next/image';

interface Review {
    id: string;
    author: string;
    role: string;
    rating: number;
    date: string;
    content: string;
    avatar: string;
    photos?: string[];
}

const MOCK_REVIEWS: Review[] = [
    {
        id: '1',
        author: 'Ankita Prakash',
        role: 'Local Guide',
        rating: 5,
        date: '2 months ago',
        content: 'We had chicken hakka noodles, chicken cheese sandwich, chicken tagda roll, and got chicken crispy and chicken manchurian as parcel. The food is good for the price point, and the quantity is also sufficient.',
        avatar: '', // Will use initial
    },
    {
        id: '2',
        author: 'Anand Kumar Sharma',
        role: '6 reviews • 1 photo',
        rating: 5,
        date: '9 months ago',
        content: 'Had a fantastic experience, truly a serene place to sit and enjoy food with friends. Also do try their paneer frankie, it\'s the best frankie I had in years.',
        avatar: '',
    },
    {
        id: '3',
        author: 'Tek Singh',
        role: 'Local Guide • 7 reviews',
        rating: 5,
        date: '2 years ago',
        content: 'Good place to eat in IIT, near hostel 1. Food: 5/5 | Service: 4/5 | Atmosphere: 4/5. Recommended dishes: Veg Noodles. Large vegetarian selection.',
        avatar: '',
    },
    {
        id: '4',
        author: 'Sandeep Maurya',
        role: 'Local Guide',
        rating: 5,
        date: '1 year ago',
        content: 'Excellent taste and very quick service. The quality of ingredients is clearly visible in the taste. Highly recommend the Biryani!',
        avatar: '',
    }
];

// Helper to get initials and color
const getAvatarDetails = (name: string) => {
    const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const colors = [
        'bg-blue-500', 'bg-purple-500', 'bg-emerald-500', 'bg-amber-500', 
        'bg-rose-500', 'bg-indigo-500', 'bg-cyan-500'
    ];
    // Simple hash to keep color consistent for a name
    const charCodeSum = name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const colorClass = colors[charCodeSum % colors.length];
    return { initials, colorClass };
};

export default function ReviewsSlider() {
    const [index, setIndex] = useState(0);
    const [direction, setDirection] = useState(0);

    const nextStep = () => {
        setDirection(1);
        setIndex((prev) => (prev + 1) % MOCK_REVIEWS.length);
    };

    const prevStep = () => {
        setDirection(-1);
        setIndex((prev) => (prev - 1 + MOCK_REVIEWS.length) % MOCK_REVIEWS.length);
    };

    // Auto-scroll logic
    useEffect(() => {
        const interval = setInterval(nextStep, 6000);
        return () => clearInterval(interval);
    }, []);

    const variants = {
        enter: (dir: number) => ({
            x: dir > 0 ? 1000 : -1000,
            opacity: 0,
            scale: 0.95
        }),
        center: {
            zIndex: 1,
            x: 0,
            opacity: 1,
            scale: 1
        },
        exit: (dir: number) => ({
            zIndex: 0,
            x: dir < 0 ? 1000 : -1000,
            opacity: 0,
            scale: 0.95
        })
    };

    const activeReview = MOCK_REVIEWS[index];
    const { initials, colorClass } = getAvatarDetails(activeReview.author);

    return (
        <section className="py-24 bg-white overflow-hidden scroll-mt-20">
            <div className="container mx-auto px-4">
                <div className="text-center mb-20">
                    <div className="inline-flex items-center gap-2 px-5 py-2 bg-red-50 text-red-600 rounded-full text-xs font-black uppercase tracking-widest mb-6 border border-red-100/50">
                        <Users size={14} className="fill-red-600/10" />
                        Campus Voices
                    </div>
                    <h2 className="text-4xl md:text-6xl font-black text-gray-900 mb-6 tracking-tighter">
                        Google <span className="text-red-600 italic">Reviews</span>
                    </h2>
                    <p className="text-gray-500 font-bold max-w-xl mx-auto text-lg leading-relaxed">
                        What the IIM Mumbai community is saying about their favorite late-night food spot.
                    </p>
                </div>

                <div className="relative max-w-5xl mx-auto min-h-[450px] px-4 md:px-0">
                    <AnimatePresence initial={false} custom={direction} mode="wait">
                        <motion.div
                            key={index}
                            custom={direction}
                            variants={variants}
                            initial="enter"
                            animate="center"
                            exit="exit"
                            transition={{
                                x: { type: "spring", stiffness: 300, damping: 32 },
                                opacity: { duration: 0.25 },
                                scale: { duration: 0.45, ease: "easeOut" }
                            }}
                            className="bg-gray-50 rounded-[50px] p-10 md:p-16 border border-gray-100 shadow-2xl shadow-gray-200/50 relative h-full flex flex-col justify-center"
                        >
                            <div className="flex flex-col md:flex-row gap-12 items-center md:items-start text-center md:text-left">
                                {/* Initial Avatar */}
                                <div className="shrink-0">
                                    <div className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center text-white text-2xl md:text-3xl font-black shadow-xl ring-8 ring-white ${colorClass} transition-transform hover:rotate-12 duration-500`}>
                                        {initials}
                                    </div>
                                </div>

                                <div className="flex-1 space-y-6">
                                    {/* Author & Meta */}
                                    <div className="space-y-1">
                                        <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 justify-center md:justify-start">
                                            <h4 className="font-black text-gray-900 text-2xl tracking-tight">{activeReview.author}</h4>
                                            <div className="flex items-center gap-1.5 justify-center">
                                                <div className="w-1.5 h-1.5 rounded-full bg-gray-300 hidden md:block"></div>
                                                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest">{activeReview.role}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 justify-center md:justify-start text-gray-400 text-sm font-bold">
                                            <span className="flex text-yellow-400">
                                                {[...Array(5)].map((_, i) => (
                                                    <Star key={i} size={16} fill="currentColor" />
                                                ))}
                                            </span>
                                            <span className="md:ml-1 md:before:content-['•'] md:before:mr-2">{activeReview.date}</span>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="relative">
                                        <Quote size={40} className="absolute -top-6 -left-8 text-red-500/10 -scale-x-100" />
                                        <p className="text-gray-700 text-lg md:text-2xl font-bold leading-relaxed tracking-tight">
                                            {activeReview.content}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Decorative Google G */}
                            <div className="absolute bottom-10 right-10 opacity-[0.03] pointer-events-none hidden md:block">
                                <svg viewBox="0 0 24 24" width="120" height="120" fill="currentColor">
                                    <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
                                </svg>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation */}
                    <div className="flex justify-center gap-6 mt-16 sm:mt-0">
                        <button
                            onClick={prevStep}
                            className="sm:absolute sm:-left-12 sm:top-1/2 sm:-translate-y-1/2 bg-white hover:bg-red-600 hover:text-white text-gray-400 p-5 rounded-full shadow-2xl transition-all border border-gray-50 group z-10"
                        >
                            <ChevronLeft size={28} className="group-hover:-translate-x-1 transition-transform" />
                        </button>
                        <button
                            onClick={nextStep}
                            className="sm:absolute sm:-right-12 sm:top-1/2 sm:-translate-y-1/2 bg-white hover:bg-red-600 hover:text-white text-gray-400 p-5 rounded-full shadow-2xl transition-all border border-gray-50 group z-10"
                        >
                            <ChevronRight size={28} className="group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>

                {/* Dots */}
                <div className="flex justify-center gap-3 mt-12">
                    {MOCK_REVIEWS.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => {
                                setDirection(i > index ? 1 : -1);
                                setIndex(i);
                            }}
                            className={`h-2.5 rounded-full transition-all duration-500 ${i === index ? 'w-12 bg-red-600' : 'w-2.5 bg-gray-200 hover:bg-gray-300'}`}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
}
