import java.util.*;

public class PalindromeCheckerApp {

    public static void main(String[] args) {

        Scanner scanner = new Scanner(System.in);

        System.out.println("Palindrome Checker App - UC13 (Performance Comparison)");
        System.out.println("Enter a string:");

        String input = scanner.nextLine();
        String normalized = input.toLowerCase().replaceAll("\\s+", "");

        long start1 = System.nanoTime();
        boolean result1 = reverseStringMethod(normalized);
        long end1 = System.nanoTime();
        long time1 = end1 - start1;

        long start2 = System.nanoTime();
        boolean result2 = stackMethod(normalized);
        long end2 = System.nanoTime();
        long time2 = end2 - start2;

        long start3 = System.nanoTime();
        boolean result3 = twoPointerMethod(normalized);
        long end3 = System.nanoTime();
        long time3 = end3 - start3;

        System.out.println("\nResults:");
        System.out.println("Reverse String Method: " + result1 + " | Time: " + time1 + " ns");
        System.out.println("Stack Method: " + result2 + " | Time: " + time2 + " ns");
        System.out.println("Two Pointer Method: " + result3 + " | Time: " + time3 + " ns");

        scanner.close();
    }

    public static boolean reverseStringMethod(String str) {
        String reversed = "";
        for (int i = str.length() - 1; i >= 0; i--) {
            reversed = reversed + str.charAt(i);
        }
        return str.equals(reversed);
    }

    public static boolean stackMethod(String str) {
        Stack<Character> stack = new Stack<>();
        for (char ch : str.toCharArray()) {
            stack.push(ch);
        }
        for (char ch : str.toCharArray()) {
            if (ch != stack.pop()) {
                return false;
            }
        }
        return true;
    }

    public static boolean twoPointerMethod(String str) {
        int start = 0;
        int end = str.length() - 1;

        while (start < end) {
            if (str.charAt(start) != str.charAt(end)) {
                return false;
            }
            start++;
            end--;
        }
        return true;
    }
}