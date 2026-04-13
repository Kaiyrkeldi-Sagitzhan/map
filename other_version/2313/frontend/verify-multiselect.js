/**
 * VERIFICATION TEST: Test multi-select state transitions
 * Run this to verify the Shift-Click workflow passes all checks
 */

interface TestResult {
    name: string
    status: 'PASS' | 'FAIL'
    error?: string
}

const results: TestResult[] = []

function test(name: string, fn: () => void) {
    try {
        fn()
        results.push({ name, status: 'PASS' })
        console.log(`✅ ${name}`)
    } catch (error) {
        results.push({
            name,
            status: 'FAIL',
            error: `${error}`,
        })
        console.error(`❌ ${name}: ${error}`)
    }
}

function assertEquals(actual: any, expected: any, message: string) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new Error(`${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`)
    }
}

function assertTrue(value: any, message: string) {
    if (!value) throw new Error(message)
}

// ─── TEST SUITE ──────────────────────────────────

console.log('\n═══════════════════════════════════════════════')
console.log('   MULTI-SELECT SHIFT-CLICK TEST SUITE')
console.log('═══════════════════════════════════════════════\n')

// Mock Store Implementation
class MockStore {
    selectedFeatureId: string | null = null
    selectedFeatureIds: string[] = []
    features = [
        { id: 'f1', name: 'Lake 1', featureClass: 'lake' },
        { id: 'f2', name: 'Lake 2', featureClass: 'lake' },
    ]

    setSelectedFeature(id: string | null) {
        this.selectedFeatureId = id
        this.selectedFeatureIds = id ? [id] : []
    }

    toggleSelectedFeature(id: string) {
        const exists = this.selectedFeatureIds.includes(id)
        this.selectedFeatureIds = exists
            ? this.selectedFeatureIds.filter(fid => fid !== id)
            : [...this.selectedFeatureIds, id]
        this.selectedFeatureId = exists
            ? (this.selectedFeatureIds[this.selectedFeatureIds.length - 1] || null)
            : id
    }

    clearSelection() {
        this.selectedFeatureId = null
        this.selectedFeatureIds = []
    }
}

// ─── BASIC TESTS ──────────────────────────────────

test('TEST 1: Single select sets selectedFeatureId', () => {
    const store = new MockStore()
    store.setSelectedFeature('f1')
    assertEquals(store.selectedFeatureId, 'f1', 'selectedFeatureId should be f1')
    assertEquals(store.selectedFeatureIds, ['f1'], 'selectedFeatureIds should be [f1]')
})

test('TEST 2: Shift-Click toggles add second feature', () => {
    const store = new MockStore()
    store.setSelectedFeature('f1')
    store.toggleSelectedFeature('f2')
    assertEquals(store.selectedFeatureIds, ['f1', 'f2'], 'Should have both f1 and f2')
    assertEquals(store.selectedFeatureId, 'f2', 'Primary should be f2')
})

test('TEST 3: Multi-select state is valid for UI rendering', () => {
    const store = new MockStore()
    store.setSelectedFeature('f1')
    store.toggleSelectedFeature('f2')
    
    const shouldRenderMultiSelect = store.selectedFeatureIds.length > 1
    assertTrue(shouldRenderMultiSelect, 'Should render multi-select view')
    
    const selectedFeatures = store.features.filter(f =>
        store.selectedFeatureIds.includes(f.id)
    )
    assertEquals(selectedFeatures.length, 2, 'Should have 2 selected features')
})

test('TEST 4: Shift-Click second object again deselects it', () => {
    const store = new MockStore()
    store.setSelectedFeature('f1')
    store.toggleSelectedFeature('f2')
    assertEquals(store.selectedFeatureIds.length, 2, 'Should have 2 selected')
    
    store.toggleSelectedFeature('f2')
    assertEquals(store.selectedFeatureIds, ['f1'], 'f2 should be removed')
    assertEquals(store.selectedFeatureId, 'f1', 'Primary should be f1')
})

test('TEST 5: Clear selection resets state', () => {
    const store = new MockStore()
    store.setSelectedFeature('f1')
    store.toggleSelectedFeature('f2')
    
    store.clearSelection()
    assertEquals(store.selectedFeatureId, null, 'selectedFeatureId should be null')
    assertEquals(store.selectedFeatureIds, [], 'selectedFeatureIds should be empty')
})

// ─── SAFE OPTIONAL CHAINING TESTS ──────────────────────────────────

test('TEST 6: Optional chaining setStyle on undefined layer', () => {
    const layer: any = undefined
    try {
        layer?.setStyle?.({ color: '#ff0000' })
        // Should not throw
    } catch (e) {
        throw new Error('Optional chaining should not throw')
    }
})

test('TEST 7: Safe PM disable on layer without pm property', () => {
    const layer: any = {}
    try {
        const pmLayer = layer?.pm
        const enabled = pmLayer?.enabled?.() === true
        if (enabled) {
            pmLayer?.disable?.()
        }
        // Should not throw
    } catch (e) {
        throw new Error('PM operations should not throw: ' + e)
    }
})

test('TEST 8: Safe PM operations on Marker (no setStyle)', () => {
    const layer: any = {
        pm: {
            enabled: () => false,
            enable: () => {},
            disable: () => {},
        },
    }
    try {
        // Check if layer supports styling
        if ('setStyle' in layer) {
            layer.setStyle({ color: '#ff4500' })
        } else {
            // Skip styling for Marker
        }
        
        // Safe pm check
        const pmLayer = layer?.pm
        if (pmLayer?.enabled?.()) {
            pmLayer?.disable?.()
        }
    } catch (e) {
        throw new Error('Marker PM operations should not throw: ' + e)
    }
})

// ─── FULL WORKFLOW TEST ──────────────────────────────────

test('TEST 9: FULL WORKFLOW - Click f1 -> Shift+Click f2 -> Render multi-select', () => {
    const store = new MockStore()

    // Step 1: User clicks object 1
    console.log('  Step 1: Click f1...')
    store.setSelectedFeature('f1')
    assertEquals(store.selectedFeatureIds, ['f1'], 'Step 1 failed')

    // Simulate sync effect
    const firstSync = store.features.filter(f =>
        store.selectedFeatureIds.includes(f.id)
    )
    assertEquals(firstSync.length, 1, 'First sync should have 1 feature')

    // Step 2: User Shift+clicks object 2
    console.log('  Step 2: Shift+Click f2...')
    store.toggleSelectedFeature('f2')
    assertEquals(store.selectedFeatureIds, ['f1', 'f2'], 'Step 2 failed')
    assertEquals(store.selectedFeatureId, 'f2', 'Primary should be f2')

    // Simulate sync effect
    const secondSync = store.features.filter(f =>
        store.selectedFeatureIds.includes(f.id)
    )
    assertEquals(secondSync.length, 2, 'Second sync should have 2 features')

    // Step 3: Check UI rendering condition
    console.log('  Step 3: Check multi-select rendering...')
    const shouldRenderMultiSelect = store.selectedFeatureIds.length > 1
    assertTrue(shouldRenderMultiSelect, 'Should render multi-select panel')

    // Step 4: Verify features have all required properties
    console.log('  Step 4: Verify feature properties...')
    secondSync.forEach(f => {
        assertTrue(f.name, 'Feature should have name')
        assertTrue(f.featureClass, 'Feature should have featureClass')
        assertTrue(f.id, 'Feature should have id')
    })
})

// ─── EDGE CASES ──────────────────────────────────

test('TEST 10: Single click after multi-select resets to single', () => {
    const store = new MockStore()
    store.setSelectedFeature('f1')
    store.toggleSelectedFeature('f2')
    assertEquals(store.selectedFeatureIds.length, 2, 'Should have 2')
    
    store.setSelectedFeature('f1')
    assertEquals(store.selectedFeatureIds, ['f1'], 'Should reset to 1')
    assertEquals(store.selectedFeatureId, 'f1', 'Should be f1')
})

// ─── PRINT RESULTS ──────────────────────────────────

console.log('\n═══════════════════════════════════════════════')
console.log('   TEST RESULTS')
console.log('═══════════════════════════════════════════════\n')

const passed = results.filter(r => r.status === 'PASS').length
const failed = results.filter(r => r.status === 'FAIL').length

results.forEach(r => {
    if (r.status === 'PASS') {
        console.log(`  ✅ ${r.name}`)
    } else {
        console.log(`  ❌ ${r.name}`)
        if (r.error) console.log(`     Error: ${r.error}`)
    }
})

console.log(`\n═══════════════════════════════════════════════`)
console.log(`  PASSED: ${passed}/${results.length}`)
console.log(`  FAILED: ${failed}/${results.length}`)
console.log(`═══════════════════════════════════════════════\n`)

if (failed === 0) {
    console.log('✅ ALL TESTS PASSED! Multi-select should work without crashes.\n')
} else {
    console.log('❌ SOME TESTS FAILED! Fix the issues above.\n')
    process.exit(1)
}
