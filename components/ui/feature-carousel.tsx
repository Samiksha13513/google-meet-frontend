"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Image from "next/image";

interface FeatureSlide {
  id: number;
  title: string;
  description: string;
  highlightText?: string;
  image: string;
}

const slides: FeatureSlide[] = [
  {
    id: 1,
    title: "Get a link you can share",
    description: "to get a link you can send to people you want to meet with",
    highlightText: "Click New meeting",
    image: "/carousa1.svg",
  },
  {
    id: 2,
    title: "Plan ahead",
    description: "to schedule a meeting for later",
    highlightText: "Click New meeting",
    image: "/c2.svg",
  },
  {
    id: 3,
    title: "Your meeting is safe",
    
    description:
      "No one can join a meeting unless invited or admitted by the host",
    image: "/c3.svg",
  },
];

export function FeatureCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <div className="flex flex-col items-center">
      {/* Carousel */}
      <div className="flex items-center gap-4">
        {/* Left Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={prevSlide}
          className="h-10 w-10 rounded-full border-gray-200"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {/* Slide Content */}
        <div className="relative w-[320px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center"
            >
              {/* Image Circle */}
              <div className="mb-6 flex items-center justify-center">
                <div className="relative h-56 w-56 rounded-full ">
                  <Image
                    src={slides[currentSlide].image}
                    alt={slides[currentSlide].title}
                    fill
                    className="object-contain p-5"
                    priority
                  />
                </div>
              </div>

              {/* Title */}
              <h3 className="mb-2 text-center text-[28px] font-normal leading-snug text-gray-800">
                {slides[currentSlide].title}
              </h3>

              {/* Description */}
              <p className="max-w-[300px] text-center text-sm leading-6 text-gray-600">
                {slides[currentSlide].highlightText && (
                  <span className="font-medium text-gray-900">
                    {slides[currentSlide].highlightText}{" "}
                  </span>
                )}
                {slides[currentSlide].description}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Right Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={nextSlide}
          className="h-10 w-10 rounded-full border-gray-200"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Dots */}
      <div className="mt-6 flex items-center gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`h-2 w-2 rounded-full transition-all ${
              currentSlide === index ? "bg-blue-600" : "bg-gray-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}