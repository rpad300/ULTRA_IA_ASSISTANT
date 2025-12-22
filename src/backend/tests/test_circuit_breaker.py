"""
Test Circuit Breaker
Verifies that circuit breaker pattern works correctly
"""

import sys
import os
import time

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from utils.circuit_breaker import CircuitBreaker, get_circuit_breaker


def failing_function():
    """Function that always fails."""
    raise Exception("Simulated failure")


def successful_function():
    """Function that always succeeds."""
    return "Success"


def test_circuit_breaker():
    """Test circuit breaker behavior."""
    print("Testing Circuit Breaker...")
    print("=" * 50)
    
    # Create circuit breaker with low thresholds for testing
    breaker = CircuitBreaker(
        failure_threshold=3,
        success_timeout=5,
        time_window=10,
        name="test_circuit"
    )
    
    print(f"Circuit breaker created:")
    print(f"  Failure threshold: {breaker.failure_threshold}")
    print(f"  Success timeout: {breaker.success_timeout}s")
    print(f"  Time window: {breaker.time_window}s")
    print()
    
    # Test 1: Normal operation (CLOSED)
    print("Test 1: Normal operation (CLOSED state)")
    print("-" * 50)
    try:
        result = breaker.call(successful_function)
        print(f"✅ Success: {result}")
        print(f"   State: {breaker.state.value}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
    print()
    
    # Test 2: Failures leading to OPEN
    print("Test 2: Failures leading to OPEN state")
    print("-" * 50)
    for i in range(breaker.failure_threshold + 1):
        try:
            breaker.call(failing_function)
        except Exception as e:
            print(f"  Failure {i+1}: {e}")
            print(f"    State: {breaker.state.value}, Failures: {breaker.failure_count}")
    
    print(f"\n✅ Circuit breaker is now {breaker.state.value}")
    print()
    
    # Test 3: Circuit OPEN - requests should be rejected
    print("Test 3: Circuit OPEN - requests should be rejected")
    print("-" * 50)
    try:
        breaker.call(successful_function)
        print("❌ Should have been rejected!")
    except Exception as e:
        print(f"✅ Request correctly rejected: {e}")
    print()
    
    # Test 4: Wait for recovery timeout
    print("Test 4: Waiting for recovery timeout...")
    print("-" * 50)
    print(f"  Waiting {breaker.success_timeout + 1} seconds...")
    time.sleep(breaker.success_timeout + 1)
    
    # Test 5: Circuit should be HALF_OPEN
    print("\nTest 5: Circuit should be HALF_OPEN")
    print("-" * 50)
    try:
        result = breaker.call(successful_function)
        print(f"✅ Success after timeout: {result}")
        print(f"   State: {breaker.state.value}")
        print("   Circuit breaker recovered!")
    except Exception as e:
        print(f"❌ Error: {e}")
    print()
    
    # Test 6: Using decorator
    print("Test 6: Using circuit breaker decorator")
    print("-" * 50)
    
    from utils.circuit_breaker import circuit_breaker
    
    @circuit_breaker("decorator_test", failure_threshold=2)
    def decorated_function():
        return "Decorated success"
    
    try:
        result = decorated_function()
        print(f"✅ Decorated function: {result}")
    except Exception as e:
        print(f"❌ Error: {e}")
    
    print("\n" + "=" * 50)
    print("✅ Circuit breaker test completed!")


if __name__ == "__main__":
    test_circuit_breaker()

