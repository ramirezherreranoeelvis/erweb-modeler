import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
      selector: 'g[cardinality-markers]',
      imports: [CommonModule],
      templateUrl: './cardinality-markers.html',
})
export class CardinalityMarkers {
      theme = input.required<'light' | 'dark'>();

      w = 22;
      h = 12;
      midY = 6;

      // Computed properties for colors based on theme
      get strokeColor() {
            return () => (this.theme() === 'dark' ? '#94a3b8' : '#475569');
      }

      get circleFill() {
            return () => (this.theme() === 'dark' ? '#1e293b' : 'white');
      }
}
