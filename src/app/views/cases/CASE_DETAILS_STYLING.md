# Case Details Modal - Professional Styling Guide

## ✨ Visual Enhancements

### Modal Container
- **Background**: Subtle gradient with red accent (5% opacity)
- **Border**: Elegant 1px border with red tint (10% opacity)
- **Shadow**: Professional shadow (0 32px 72px with 15% opacity)
- **Border Radius**: 1.5rem for modern rounded corners

### Form Fields
- **Background**: Linear gradient (white 95% → light gray 98%)
- **Border**: Red-tinted border (8% opacity), changes on interaction
- **Padding**: Increased padding (1rem) for better spacing
- **Hover Effect**: Border color intensifies + shadow appears
- **Focus Effect**: Red border + blue glow (3px shadow with 10% opacity)
- **Disabled State**: Light red background with reduced opacity

### Labels
- **Font Size**: Larger 0.82rem (12px)
- **Font Weight**: Heavy 800 (bold)
- **Styling**: UPPERCASE with 0.05em letter-spacing
- **Required**: Red asterisk indicator
- **Color**: Dark brown (#5e4348)

### Input & Textarea Fields
- **Background**: Clean white with slight transparency
- **Border**: 1.5px refined border with red tint
- **Font Size**: 0.95rem (readable)
- **Padding**: 0.85rem x 1rem (touch-friendly)
- **Placeholder**: Muted color (50% opacity)
- **Focus State**: 
  - Solid red border
  - Blue glow effect (3px)
  - Lifted shadow effect

### Section Dividers
- **Style**: Gradient line (red 30% → 8% → 30%)
- **Height**: 1.5px (more visible than dashed)
- **Margin**: 1.5rem top/bottom for better spacing

### Section Headers (Subtitles)
- **Background**: Light red gradient (8% → 4% opacity)
- **Border-Left**: 4px solid red accent
- **Icon**: Red circular dot (animated in)
- **Typography**: Uppercase, bold, 0.88rem
- **Styling**: Professional section marker

### Data Display Values
- **Style**: Color-coded boxes with left accent border
- **Primary** (Red):
  - Background: Light red gradient (5% opacity)
  - Border-left: Red (3px)
- **Success** (Green):
  - Background: Light green gradient (8% opacity)
  - Border-left: Green (#1b8a5a)
- **Warning** (Amber):
  - Background: Light amber gradient (8% opacity)
  - Border-left: Amber (#d68b00)
- **Danger** (Red):
  - Background: Light danger gradient (8% opacity)
  - Border-left: Danger (#a11d2b)

### Timeline Items
- **Background**: White with slight gradient
- **Border-Left**: 4px colored accent (changes on status)
- **States**:
  - **Completed**: Green border
  - **Pending**: Amber border
  - **Error**: Red border
- **Padding**: 0.9rem x 1rem

### Modal Buttons
- **Confirm Button**:
  - Gradient: Red → Lighter red
  - Shadow: 12px 28px with 25% opacity
  - Hover: Lift (-2px) + enhanced shadow
- **Cancel Button**:
  - Background: White 90%
  - Border: 1px red tint (20% opacity)
  - Hover: Solid white with enhanced border

## 📱 Responsive Behavior

### Desktop (1200px+)
- Full modal with 2rem padding
- 2-column & 3-column grids for dense info
- All effects and transitions visible

### Tablet (768px - 1199px)
- Modal with 1.5rem padding
- Grid adjusts to 2 columns max
- Touch-optimized field sizes

### Mobile (< 768px)
- Full-screen modal (90vh max height)
- 1rem margin on all sides
- Single column layout
- Reduced padding (1rem)
- Touch-optimized input heights (2.7rem)
- Smaller field padding (0.85rem)

## 🎨 Color System

**CRM Brand Colors:**
- Primary Red: `#e30613`
- Dark Red: `#b20415`
- Success Green: `#1b8a5a`
- Warning Amber: `#d68b00`
- Danger Dark Red: `#a11d2b`
- Text Dark: `#3a1820`
- Text Muted: `#7a6066`
- Placeholder: `rgba(94, 67, 72, 0.5)`

## ✨ Interactive Effects

### Hover States
```scss
// Fields & Cards
- Border color intensifies
- Shadow appears (6-16px)
- Slight elevation effect
```

### Focus States
```scss
// Inputs & Textareas
- Border changes to CRM red
- Blue glow appears (3px shadow, 10% opacity)
- Background brightens to pure white
- Smooth transition (0.2s ease-out)
```

### Active States
```scss
// Buttons
- Slight scale down (0.98)
- Reduced shadow
- Immediate feedback
```

## 🎯 Key Differences from Previous

| Feature | Before | After |
|---------|--------|-------|
| Background | Plain white | Gradient with subtle accent |
| Borders | 1px gray | 1.5px red-tinted |
| Shadow | Basic | Professional (32px blur, 15% opacity) |
| Fields | Simple boxes | Gradient cards with hover effects |
| Labels | Basic text | Bold, uppercase, styled |
| Dividers | Dashed gray | Gradient red line |
| Focus Effect | None | Blue glow + red border |
| Section Headers | None | Red-accented bar with icon |
| Data Display | Plain text | Color-coded boxes |
| Buttons | Basic | Gradient with shadow effects |
| Responsiveness | Static | Fully responsive with mobile optimization |

## 💡 Usage Tips

### For Form Sections
1. Use `case-op-subtitle` for section headers
2. Wrap fields in `case-op-grid` or `case-op-grid-2`
3. Each field in `case-op-field` container

### For Data Display
1. Read-only values: Use `case-op-value`
2. With status color: Add class (`case-op-value--success`)
3. Regular text: Use `case-op-text`

### For Alerts
1. Info box: `case-op-info`
2. With color: Add class (`.success`, `.warning`, `.error`)
3. Automatically styled with icons

### For Sections
1. Use `case-op-divider` between sections
2. Precede with `case-op-subtitle`
3. Always use `case-op-grid` for layout consistency

## 🚀 Animation Details

All transitions use: `all 0.2s ease-out`

- **Color transitions**: 200ms
- **Shadow transitions**: 200ms
- **Transform transitions**: 200ms
- **All properties together**: Smooth uniform animation

## 📋 Border Styles

**Color-coded left borders:**
- Primary (Red): `var(--crm-red)` 4px or 3px
- Success (Green): `var(--crm-success)` 4px or 3px
- Warning (Amber): `var(--crm-amber)` 4px or 3px
- Danger (Red): `var(--crm-danger)` 4px or 3px

## ✅ Accessibility

- High contrast text colors
- Clear focus indicators (blue glow)
- Readable placeholder text (50% opacity)
- Touch-friendly sizes (2.7rem minimum)
- Semantic HTML with proper labels
- Color + shape for status indication

---

**Last Updated**: April 2026  
**Component**: `activation-cases-list.component.scss`  
**Modal Plugin**: SweetAlert2  
**CRM System**: Ooredoo Activation Cases
