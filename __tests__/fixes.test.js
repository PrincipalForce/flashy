/* eslint-env jest */
/* global Flashy */

// Load the main library
const fs = require('fs');
const path = require('path');

// Setup JSDOM environment
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body><canvas></canvas></body></html>', {
  pretendToBeVisual: true,
  resources: 'usable'
});
global.window = dom.window;
global.document = dom.window.document;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;
global.CanvasRenderingContext2D = dom.window.CanvasRenderingContext2D;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.cancelAnimationFrame = clearTimeout;
global.performance = { now: () => Date.now() };

// Load Flashy
const flashyCode = fs.readFileSync(path.join(__dirname, '../flashy.js'), 'utf8');
eval(flashyCode);

describe('Fix Verification Tests', () => {
  
  describe('IMP-001: Graphics Memory Leak Fix', () => {
    test('Graphics.clear() properly resets command arrays and bounds', () => {
      const g = new Flashy.Graphics();
      
      // Add some commands
      g.beginFill(0xff0000, 1);
      g.drawRect(10, 20, 100, 200);
      g.endFill();
      g.lineStyle(2, 0x00ff00, 0.8);
      g.moveTo(0, 0);
      g.lineTo(50, 100);
      
      // Verify commands and bounds exist
      expect(g._cmds.length).toBeGreaterThan(0);
      expect(g._bounds).toBeTruthy();
      const bounds = g.getBounds();
      expect(bounds.width).toBeGreaterThan(0);
      expect(bounds.height).toBeGreaterThan(0);
      
      // Clear and verify reset
      g.clear();
      expect(g._cmds.length).toBe(0);
      expect(g._bounds).toBeNull();
      
      const clearedBounds = g.getBounds();
      expect(clearedBounds.width).toBe(0);
      expect(clearedBounds.height).toBe(0);
      expect(clearedBounds.x).toBe(0);
      expect(clearedBounds.y).toBe(0);
    });

    test('Graphics command array does not grow indefinitely with limits', () => {
      const maxCommands = 1000;
      const g = new Flashy.Graphics(maxCommands);
      
      // Add more commands than the limit
      for (let i = 0; i < 1500; i++) {
        g.moveTo(i, i);
        g.lineTo(i + 10, i + 10);
      }
      
      // Should not exceed the limit
      expect(g._cmds.length).toBeLessThanOrEqual(maxCommands);
      expect(g._cmds.length).toBeGreaterThan(0);
    });

    test('DisplayObject._cleanup() is called on removal from display list', () => {
      const shape = new Flashy.Shape();
      const container = new Flashy.DisplayObjectContainer();
      
      // Mock cleanup method
      shape._cleanup = jest.fn();
      
      container.addChild(shape);
      expect(shape.parent).toBe(container);
      
      container.removeChild(shape);
      expect(shape.parent).toBeNull();
      expect(shape._cleanup).toHaveBeenCalled();
    });

    test('removeAllChildren calls cleanup on all children', () => {
      const container = new Flashy.DisplayObjectContainer();
      const shapes = [];
      
      // Create shapes with cleanup mocks
      for (let i = 0; i < 5; i++) {
        const shape = new Flashy.Shape();
        shape._cleanup = jest.fn();
        shapes.push(shape);
        container.addChild(shape);
      }
      
      expect(container.children.length).toBe(5);
      
      container.removeAllChildren();
      expect(container.children.length).toBe(0);
      
      shapes.forEach(shape => {
        expect(shape.parent).toBeNull();
        expect(shape._cleanup).toHaveBeenCalled();
      });
    });

    test('Graphics._cleanup properly clears resources', () => {
      const shape = new Flashy.Shape();
      const g = shape.graphics;
      
      // Add commands to graphics
      g.beginFill(0x123456, 0.8);
      g.drawCircle(0, 0, 50);
      g.endFill();
      
      expect(g._cmds.length).toBeGreaterThan(0);
      expect(g._bounds).toBeTruthy();
      
      // Call cleanup
      shape._cleanup();
      
      expect(g._cmds.length).toBe(0);
      expect(g._bounds).toBeNull();
    });
  });

  describe('IMP-003: ES6 Module System (Backward Compatibility)', () => {
    test('Global Flashy object is still available', () => {
      expect(typeof Flashy).toBe('object');
      expect(Flashy.version).toBeDefined();
      expect(typeof Flashy.Stage).toBe('function');
      expect(typeof Flashy.MovieClip).toBe('function');
      expect(typeof Flashy.Graphics).toBe('function');
    });

    test('All core classes are accessible via global namespace', () => {
      const expectedClasses = [
        'Stage', 'MovieClip', 'Shape', 'TextField', 'Graphics',
        'DisplayObject', 'DisplayObjectContainer', 'Timeline', 'Tween'
      ];
      
      expectedClasses.forEach(className => {
        expect(typeof Flashy[className]).toBe('function');
        expect(Flashy[className].name).toBe(className);
      });
    });

    test('Easing functions are accessible', () => {
      expect(typeof Flashy.Easing).toBe('object');
      expect(typeof Flashy.Easing.linear).toBe('function');
      expect(typeof Flashy.Easing.bounceOut).toBe('function');
      expect(typeof Flashy.Easing.elasticOut).toBe('function');
      
      // Test easing function behavior
      expect(Flashy.Easing.linear(0.5)).toBe(0.5);
      expect(Flashy.Easing.linear(0)).toBe(0);
      expect(Flashy.Easing.linear(1)).toBe(1);
    });

    test('Utility functions are accessible', () => {
      expect(typeof Flashy.toRGBA).toBe('function');
      
      // Test utility function
      expect(Flashy.toRGBA(0xff0000, 0.5)).toBe('rgba(255,0,0,0.5)');
      expect(Flashy.toRGBA('#ff0000', 1)).toBe('#ff0000');
    });
  });

  describe('IMP-005: Error Handling for Frame Scripts', () => {
    test('Malformed frame scripts do not crash timeline execution', () => {
      const mc = new Flashy.MovieClip();
      mc.timeline.setTotalFrames(10);
      
      // Add a frame script that throws an error
      mc.timeline.addFrameScript(5, function() {
        throw new Error('Test error in frame script');
      });
      
      // Mock console.warn to capture error handling
      const originalWarn = console.warn;
      const mockWarn = jest.fn();
      console.warn = mockWarn;
      
      // Should not throw when going to that frame
      expect(() => {
        mc.gotoAndStop(5);
      }).not.toThrow();
      
      // Should have logged the error
      expect(mockWarn).toHaveBeenCalledWith('Frame script error:', expect.any(Error));
      
      // Restore console.warn
      console.warn = originalWarn;
    });

    test('Timeline continues execution after frame script error', () => {
      const mc = new Flashy.MovieClip();
      mc.timeline.setTotalFrames(10);
      
      let frame3Executed = false;
      let frame7Executed = false;
      
      // Add frame scripts
      mc.timeline.addFrameScript(3, function() {
        frame3Executed = true;
      });
      
      mc.timeline.addFrameScript(5, function() {
        throw new Error('Test error');
      });
      
      mc.timeline.addFrameScript(7, function() {
        frame7Executed = true;
      });
      
      // Mock console.warn
      const originalWarn = console.warn;
      console.warn = jest.fn();
      
      // Execute frames
      mc.gotoAndStop(3);
      expect(frame3Executed).toBe(true);
      
      mc.gotoAndStop(5); // Should not crash
      mc.gotoAndStop(7);
      expect(frame7Executed).toBe(true);
      
      console.warn = originalWarn;
    });

    test('MovieClip _tick continues after frame script error', () => {
      const mc = new Flashy.MovieClip();
      mc.timeline.setTotalFrames(5);
      
      let tickCount = 0;
      mc.addEventListener('enterFrame', () => { tickCount++; });
      
      // Add error-throwing frame script
      mc.timeline.addFrameScript(3, function() {
        throw new Error('Frame script error');
      });
      
      // Mock console.warn
      const originalWarn = console.warn;
      console.warn = jest.fn();
      
      // Simulate multiple ticks
      mc._tick(16); // Frame 1
      mc._tick(16); // Frame 2
      mc._tick(16); // Frame 3 (error)
      mc._tick(16); // Frame 4 (should continue)
      
      expect(tickCount).toBe(4);
      expect(mc.currentFrame).toBe(4);
      
      console.warn = originalWarn;
    });
  });

  describe('Core Engine Stability', () => {
    test('Stage can be created and started without errors', () => {
      const canvas = document.createElement('canvas');
      
      expect(() => {
        const stage = new Flashy.Stage(canvas, {
          width: 800,
          height: 600,
          fps: 30,
          backgroundColor: 0xffffff
        });
        
        expect(stage.width).toBe(800);
        expect(stage.height).toBe(600);
        expect(stage.fps).toBe(30);
        expect(stage.backgroundColor).toBe(0xffffff);
        
        stage.start();
        stage.stop();
      }).not.toThrow();
    });

    test('Complex display list operations work correctly', () => {
      const root = new Flashy.MovieClip();
      
      // Create nested structure
      const container1 = new Flashy.MovieClip();
      const container2 = new Flashy.MovieClip();
      const shape1 = new Flashy.Shape();
      const shape2 = new Flashy.Shape();
      
      // Build hierarchy
      root.addChild(container1);
      container1.addChild(container2);
      container2.addChild(shape1);
      container1.addChild(shape2);
      
      expect(root.children.length).toBe(1);
      expect(container1.children.length).toBe(2);
      expect(container2.children.length).toBe(1);
      
      expect(shape1.parent).toBe(container2);
      expect(shape2.parent).toBe(container1);
      expect(container1.parent).toBe(root);
      
      // Test removal
      container1.removeChild(container2);
      expect(container1.children.length).toBe(1);
      expect(container2.parent).toBeNull();
      expect(shape1.parent).toBe(container2); // Still attached to removed container
    });

    test('Timeline tweens work correctly', () => {
      const target = { x: 0, y: 0, alpha: 1 };
      const tl = new Flashy.Timeline(null);
      
      tl.addTween(target, 'x', 0, 100, 1, 30, 'linear');
      tl.addTween(target, 'y', 0, 50, 1, 30, 'quadOut');
      tl.addTween(target, 'alpha', 1, 0.5, 15, 30, 'sineInOut');
      
      // Test start values
      tl.update(1);
      expect(target.x).toBe(0);
      expect(target.y).toBe(0);
      expect(target.alpha).toBe(1);
      
      // Test middle values
      tl.update(15);
      expect(target.x).toBeCloseTo(50, 1); // Linear halfway
      expect(target.y).toBeGreaterThan(25); // QuadOut should be > linear
      expect(target.alpha).toBe(1); // Alpha tween starts at frame 15
      
      // Test end values
      tl.update(30);
      expect(target.x).toBe(100);
      expect(target.y).toBe(50);
      expect(target.alpha).toBe(0.5);
    });

    test('Graphics rendering commands accumulate correctly', () => {
      const g = new Flashy.Graphics();
      
      // Complex drawing sequence
      g.beginFill(0xff0000, 0.8);
      g.moveTo(10, 10);
      g.lineTo(100, 10);
      g.lineTo(100, 100);
      g.curveTo(50, 150, 10, 100);
      g.closePath();
      g.endFill();
      
      g.lineStyle(3, 0x00ff00, 1);
      g.drawCircle(200, 50, 25);
      
      g.beginGradientFill('linear', [0x0000ff, 0xffff00], [1, 0.5], [0, 1], 0, 0, 100, 100);
      g.drawRect(150, 150, 80, 60);
      g.endFill();
      
      // Should have accumulated all commands
      expect(g._cmds.length).toBeGreaterThan(10);
      
      // Bounds should encompass all drawn elements
      const bounds = g.getBounds();
      expect(bounds.x).toBeLessThanOrEqual(10);
      expect(bounds.y).toBeLessThanOrEqual(10);
      expect(bounds.x + bounds.width).toBeGreaterThanOrEqual(230); // 200 + 25 + 5 margin
      expect(bounds.y + bounds.height).toBeGreaterThanOrEqual(210); // 150 + 60
    });

    test('Event system works correctly', () => {
      const obj = new Flashy.DisplayObject();
      let eventFired = false;
      let eventData = null;
      
      const handler = function(evt) {
        eventFired = true;
        eventData = evt;
      };
      
      obj.addEventListener('test', handler);
      expect(obj.hasEventListener('test')).toBe(true);
      
      obj.dispatchEvent('test', { customData: 'hello' });
      expect(eventFired).toBe(true);
      expect(eventData.type).toBe('test');
      expect(eventData.customData).toBe('hello');
      
      // Test removal
      obj.removeEventListener('test', handler);
      eventFired = false;
      obj.dispatchEvent('test');
      expect(eventFired).toBe(false);
    });
  });

  describe('Memory Management Regression Tests', () => {
    test('Repeated clear() operations do not cause memory leaks', () => {
      const g = new Flashy.Graphics();
      
      // Simulate heavy usage with repeated clear
      for (let i = 0; i < 100; i++) {
        g.beginFill(Math.random() * 0xffffff, Math.random());
        g.drawRect(Math.random() * 100, Math.random() * 100, 50, 50);
        g.endFill();
        
        if (i % 10 === 0) {
          g.clear();
          expect(g._cmds.length).toBe(0);
          expect(g._bounds).toBeNull();
        }
      }
    });

    test('Large display lists can be cleaned up properly', () => {
      const root = new Flashy.DisplayObjectContainer();
      const children = [];
      
      // Create large display list
      for (let i = 0; i < 1000; i++) {
        const child = new Flashy.Shape();
        child._cleanup = jest.fn();
        children.push(child);
        root.addChild(child);
      }
      
      expect(root.children.length).toBe(1000);
      
      // Remove all at once
      root.removeAllChildren();
      
      expect(root.children.length).toBe(0);
      children.forEach(child => {
        expect(child.parent).toBeNull();
        expect(child._cleanup).toHaveBeenCalled();
      });
    });

    test('Timeline with many tweens can be garbage collected', () => {
      const targets = [];
      const tl = new Flashy.Timeline(null);
      
      // Create many targets and tweens
      for (let i = 0; i < 200; i++) {
        const target = { x: 0, y: 0, rotation: 0, alpha: 1 };
        targets.push(target);
        
        tl.addTween(target, 'x', 0, 100, 1, 60, 'bounceOut');
        tl.addTween(target, 'y', 0, 100, 1, 60, 'elasticOut');
        tl.addTween(target, 'rotation', 0, Math.PI * 2, 1, 60, 'linear');
      }
      
      expect(tl.tweens.length).toBe(600); // 3 tweens per target × 200 targets
      
      // Update timeline multiple times
      for (let frame = 1; frame <= 60; frame += 10) {
        tl.update(frame);
      }
      
      // All targets should have been updated
      targets.forEach(target => {
        expect(target.x).toBeGreaterThan(0);
        expect(target.y).toBeGreaterThan(0);
      });
    });
  });
});
