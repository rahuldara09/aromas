import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

const AnimatedLogo = ({ size = 40, showText = true, color = '#0052cc', layout = 'row' }) => {
  const isRow = layout === 'row';

  return (
    <View style={[
      styles.container,
      { flexDirection: isRow ? 'row' : 'column' }
    ]}>
      {/* Abstract Logo */}
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Circle cx="50" cy="50" r="48" fill={color} />
          <Path
            d="M50 15 C54 46 85 46 85 50 C85 54 54 54 50 85 C46 54 15 54 15 50 C15 46 46 46 50 15 Z"
            fill="white"
          />
        </Svg>
      </View>

      {/* Brand Text */}
      {showText && (
        <View style={[
          styles.textContainer,
          {
            marginLeft: isRow ? 3 : 0,
            marginTop: isRow ? 0 : 12,
            alignItems: isRow ? 'flex-start' : 'center'
          }
        ]}>
          <Text style={[styles.brandName, { fontSize: size * 0.55 }]}>Vyapar</Text>
          <View style={{ height: size * 0.01 }} />
          <Text style={[styles.tagline, { fontSize: size * 0.3 }]}>Aapka Business,Ab Online.</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    justifyContent: 'center',
  },
  brandName: {
    fontWeight: '900',
    color: '#0052cc',
    lineHeight: undefined,
  },
  tagline: {
    color: '#64748b',
    fontWeight: '700',
  },
});

export default AnimatedLogo;
