#! /usr/bin/perl -w

#
## @author: Shadow Caster
## @date: Monday 9 Feb 2009
## @version 0.0
## @license: Apache 2.0
##
## This script goes through the text of all the diacritic-free Arabic quran from 
## 114 text files and counts how many of each letter there are in all the surahs.  
## It saves the results to a CSV file.
#

#There are 32 elements in this array, as per the keyboard
@chars = qw( ذ ص ث ق  ف غ ع ه خ ح ج د ش س ي ب ل ا ت ن م ك ط ئ ء ؤ ر ى ة و ز ظ ض ); 

#open each file and stick contents into one string
$m = ""; 
for($i = 1; $i < 115; $i++){
	open(HANDLE, "./c/$i.txt") or die("Couldn't open file $i.txt");
	while(<HANDLE>){
		chomp($_);
		$m .= $_;
	}
	close(HANDLE);
}

#open CSV file to save to
open(CSVHANDLE, ">./c/countallletters.csv") or die("Couldn't open CSV file");

#stick into CSV file
foreach $x(@chars){
	$uStr = $m;
	$count = 0;
	$count++ while $uStr =~ /($x)/gi;
	print CSVHANDLE "$x, $count \n" unless $count == 0;
}#/foreach

close(CSVHANDLE);
print "All Done! \n";
