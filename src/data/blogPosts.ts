export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  date: string;
  author: string;
  image: string;
  category: string;
  readingTime: string;
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'best-late-night-food-in-iim-ahmedabad',
    title: 'Best Late Night Food in IIM Ahmedabad: A Survival Guide',
    excerpt: 'Studying late at IIMA? Discover the top midnight snacks and meals that will keep you going through those intense case study sessions.',
    content: `
      <p>Life at IIM Ahmedabad is legendary for its intensity. Between case studies, group projects, and club activities, the day often stretches far into the night. And when the clock strikes midnight, the hunger pangs are real.</p>
      
      <h3>1. The Classic Paratha Experience</h3>
      <p>There's nothing quite like a hot, buttery paratha at 1 AM. At Aroma Dhaba, we specialize in a variety of parathas—from the classic Aloo Paratha to the indulgent Paneer Cheese Paratha. Served with a dollop of butter and spicy pickle, it's the ultimate comfort food.</p>
      
      <h3>2. Biryani: The Late-Night Celebration</h3>
      <p>Finished a major presentation? Celebrate with our aromatic Hyderabadi Biryani. Perfectly spiced and served hot, it's the favorite choice for groups of students looking for a substantial meal after a long day.</p>
      
      <h3>3. Quick Bites: Maggi and Sandwiches</h3>
      <p>Sometimes you just need something quick. Our range of Maggi variations and grilled sandwiches are perfect for those short breaks when you need a quick energy boost without a full meal.</p>
      
      <p>At Aroma Dhaba, we've optimized our kitchen for the IIMA schedule. We know that 11 PM to 3 AM is when you need us most, and we're committed to delivering hot, hygienic food right to your hostel.</p>
    `,
    date: 'March 25, 2026',
    author: 'Aroma Team',
    image: '/images/hero_food.png',
    category: 'Campus Life',
    readingTime: '5 min read'
  },
  {
    slug: 'how-to-order-food-in-iima-campus',
    title: 'How to Order Food in IIMA Campus: The Ultimate Convenience',
    excerpt: 'Ordering food at IIM Ahmedabad has never been easier. Learn how to use Aroma Dhaba\'s new platform for the fastest campus delivery.',
    content: `
      <p>With the launch of our new digital platform, ordering your favorite food at IIM Ahmedabad is now just a few clicks away. No more waiting on hold or dealing with busy phone lines.</p>
      
      <h3>Step 1: Browse the Menu</h3>
      <p>Visit our website and explore our extensive menu categorized for your convenience. From North Indian to Chinese and Fast Food, we have something for everyone.</p>
      
      <h3>Step 2: Customise Your Order</h3>
      <p>Want extra butter on your paratha? Or less spice in your biryani? Our platform allows you to add specific instructions for each item to ensure it's made exactly how you like it.</p>
      
      <h3>Step 3: Fast Checkout</h3>
      <p>We've integrated secure payment options including UPI, Cards, and Netbanking. Once your order is placed, our kitchen gets to work immediately.</p>
      
      <p>By ordering directly through aromadhaba.in, you get access to exclusive campus deals and faster delivery times. Bookmark us for your next midnight craving!</p>
    `,
    date: 'March 20, 2026',
    author: 'Aroma Team',
    image: '/images/hero_food.png',
    category: 'Guide',
    readingTime: '4 min read'
  },
  {
    slug: 'midnight-food-options-in-iim-ahmedabad',
    title: 'Midnight Food Options in IIM Ahmedabad: Beyond the Usual',
    excerpt: 'Tired of the same old snacks? Explore the diverse midnight menu at Aroma Dhaba, from spicy Chinese to comforting North Indian meals.',
    content: `
      <p>Midnight doesn't have to mean compromising on variety. At IIM Ahmedabad, the food scene is as diverse as the student body, and Aroma Dhaba is at the center of it.</p>
      
      <h3>Chinese Cravings</h3>
      <p>Our Schezwan Noodles and Chilli Paneer are campus legends. Made with fresh vegetables and authentic sauces, they provide that perfect spicy kick to wake you up during a late-night study session.</p>
      
      <h3>The "Dhaba" Specials</h3>
      <p>Our Dal Tadka and Kadai Paneer are made in traditional dhaba style, providing a taste of home in the middle of the campus. Paired with fresh rotis, it's a meal that satisfies both the hunger and the soul.</p>
      
      <p>Aroma Dhaba is more than just a food outlet; it's a campus institution dedicated to serving the IIMA community. Next time you're hungry at 2 AM, remember we're just a click away.</p>
    `,
    date: 'March 15, 2026',
    author: 'Aroma Team',
    image: '/images/hero_food.png',
    category: 'Food',
    readingTime: '6 min read'
  }
];
