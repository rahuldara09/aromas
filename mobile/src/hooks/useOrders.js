import { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';

export const useOrders = () => {
  const [orders, setOrders] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [hasUnacknowledged, setHasUnacknowledged] = useState(false);
  const soundRef = useRef(null);
  const isFirstLoad = useRef(true);
  const intervalRef = useRef(null);

  useEffect(() => {
    // Load sound
    const loadSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/alert.mp3')
        );
        soundRef.current = sound;
      } catch (err) {
        console.warn("Could not load alert sound. Make sure assets/sounds/alert.mp3 exists.", err);
      }
    };
    loadSound();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'orders'), orderBy('orderDate', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = [];
      let newPendingAdded = false;

      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        fetchedOrders.push({ id: doc.id, ...data });
      });

      if (isFirstLoad.current) {
        isFirstLoad.current = false;
      } else {
        snapshot.docChanges().forEach((change) => {
          // Alert for new pending orders
          if (change.type === 'added' && change.doc.data().status === 'Pending') {
            newPendingAdded = true;
          }
        });
      }

      setOrders(fetchedOrders);
      
      const pending = fetchedOrders.filter(o => o.status === 'Pending').length;
      setPendingCount(pending);

      if (newPendingAdded) {
        setHasUnacknowledged(true);
      } else if (pending === 0) {
        setHasUnacknowledged(false);
      }

    }, (error) => {
      console.error("Error fetching orders:", error);
      if (error.code === 'permission-denied') {
        import('firebase/auth').then(({ signOut }) => {
          signOut(auth);
        }).catch(err => console.error("Logout error", err));
      }
    });

    return () => unsubscribe();
  }, []);

  // Alert Loop
  useEffect(() => {
    if (hasUnacknowledged && pendingCount > 0) {
      // Trigger strong vibration and sound initially
      triggerAlert();
      
      // Setup loop
      intervalRef.current = setInterval(() => {
        triggerAlert();
      }, 5000); // Repeat every 5 seconds until accepted
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasUnacknowledged, pendingCount]);

  const triggerAlert = async () => {
    // Strong vibration pattern
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 200);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 400);

    if (soundRef.current) {
      try {
        await soundRef.current.replayAsync();
      } catch (err) {
        // Handle error gracefully
      }
    }
  };

  const acknowledgeAlerts = () => {
    setHasUnacknowledged(false);
  };

  return { orders, hasUnacknowledged, acknowledgeAlerts, pendingCount };
};
